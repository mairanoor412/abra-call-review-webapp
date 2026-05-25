# Database Schema Reference

**Source:** `/home/maira/abra-comms-staging/data/comms.db` (read-only)
**Last updated:** 2026-05-22

## Tables Overview

| Table | Rows | Purpose |
|-------|------|---------|
| `calls` | 3,052 | Master CDR (Call Detail Records) - all inbound/outbound calls |
| `recordings_v2` | 607 | Call recordings (newer schema) - call_id → WAV filename |
| `recordings` | 2,512 | Call recordings (older schema) - call_id → WAV filename |
| `transcripts` | 1,063 | Whisper transcriptions (~35% coverage of calls) |
| `classifications` | 1,063 | Haiku AI classifications (new_patient, existing_patient, etc.) |
| `ad_calls` | 349 | Google Ads call events (campaign attribution) |
| `ad_spend` | 149 | Daily ad spend per campaign |
| `patients` | 0 | Empty (Phase B - Optix integration) |

## Core Tables

### `calls` (3,052 rows)

Master call log from 3CX phone system.

**Key columns:**
- `call_id` - Unique identifier
- `call_time` - ISO timestamp (e.g., "2026-05-21T16:18:24.097Z")
- `practice` - Practice location: `middleton`, `cheadle`, `heald_green`, `heckmondwike`, `winsford`, or **NULL** (44% unattributed)
- `direction` - `inbound` or `outbound`
- `status` - `answered`, `unanswered`, `missed`, `redirected`
- `caller_number` - Phone number
- `destination` - Extension or number called
- `ringing_sec` - Ring duration
- `talking_sec` - Call duration (0 = no pickup, <10 = dropped, 10+ = connected)
- `raw_meta` - 3CX metadata JSON

**Important filters:**
```sql
-- Skip junk rows:
WHERE call_time LIKE '2026-%'

-- Exclude seed/test data:
AND (raw_meta NOT LIKE '%seed%' OR raw_meta IS NULL)
```

**Missed call logic:**
- `status = 'unanswered'` (rang out, no answer)
- `status = 'answered' AND talking_sec < 10` (dropped - caller hung up quickly)
- `status = 'redirected'` BUT no successful answered call from same caller within 60s (redirected but never picked up elsewhere)

### `recordings` & `recordings_v2`

Link call_id to WAV file on disk.

**recordings_v2** (newer):
- `id` - Recording ID
- `call_id` - FK to calls.call_id
- `filename` - WAV file path (relative to `/home/maira/abra-comms-staging/data/recordings/`)
- `duration_sec` - Recording length

**recordings** (older):
- Similar schema, legacy data

**File locations:**
```
/home/maira/abra-comms-staging/data/recordings/
├── 2026-04-22/
├── 2026-04-23/
...
└── 2026-05-21/
    └── [Practice, Extension]_512-07950312637_20260512083100(1360).wav
```

### `transcripts` (1,063 rows)

Whisper transcriptions of call recordings.

**Coverage:** ~35% of calls (65% have no transcript)

**Key columns:**
- `id` - Transcript ID
- `recording_id` - FK to recordings.id or recordings_v2.id
- `text` - Full transcription text
- `language` - Detected language (usually 'en')
- `confidence` - Whisper confidence score

### `classifications` (1,063 rows)

Haiku AI classifications of transcripts.

**Key columns:**
- `id` - Classification ID
- `transcript_id` - FK to transcripts.id
- `type` - Classification category:
  - **`new_patient`** (41 calls) - NEW patient inquiry
  - `existing_patient` (604 calls) - Existing patient
  - `unclear` (191 calls) - Cannot determine
  - `wrong_number` (191 calls) - Wrong number
  - `personal` (25 calls) - Personal call (not patient)
  - `job_applicant` (7 calls) - Job inquiry
  - `spam` (4 calls) - Spam/telemarketer
- `confidence` - AI confidence score (0-1)
- `promised_callback` - Boolean (1 = patient asked for callback)
- `promise_text` - Extracted promise ("I'll call back at 2pm")

**Classification distribution:**
```
existing_patient:  604 (57%)
unclear:           191 (18%)
wrong_number:      191 (18%)
new_patient:        41 (4%)
personal:           25 (2%)
job_applicant:       7 (<1%)
spam:                4 (<1%)
```

### `ad_calls` (349 rows)

Google Ads call tracking events.

**Key columns:**
- `id` - Ad call event ID
- `call_time` - When call occurred
- `practice` - Practice attribution
- `campaign` - Ad campaign name (e.g., "Map - Call Ads | Cheadle")
- `caller_number` - Caller's phone
- `duration_sec` - Call duration
- `matched_call_id` - FK to recordings.id or recordings_v2.id
  - **-1** = No match found (94.3% of ad_calls)
  - Valid ID = Match found (5.7% only)

**Match rate:** Only 20/349 (5.7%) have real matched_call_id to recordings

**Implication:** For 94% of ad calls, you have:
- ✅ Call event (time, caller, duration, campaign)
- ❌ NO transcript, NO classification, NO audio

### `ad_spend` (149 rows)

Daily ad spend per campaign.

**Key columns:**
- `date` - Spend date (YYYY-MM-DD)
- `practice` - Practice attribution
- `campaign` - Campaign name
- `cost_gbp` - Spend in £ GBP

## Common Queries (from digest.js)

### 1. Yesterday's call summary
```sql
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN status = 'unanswered' OR status = 'missed' THEN 1 ELSE 0 END) AS missed,
  SUM(CASE WHEN direction LIKE 'inbound%' THEN 1 ELSE 0 END) AS inbound
FROM calls
WHERE practice = ? AND DATE(call_time) = ?
```

### 2. Callback queue (unanswered with transcripts)
```sql
SELECT
  c.call_id, c.call_time, c.caller_number, c.status, c.talking_sec,
  cl.type, cl.confidence,
  t.text AS transcript_text
FROM calls c
LEFT JOIN recordings r ON c.call_id = r.call_id
LEFT JOIN transcripts t ON r.id = t.recording_id
LEFT JOIN classifications cl ON t.id = cl.transcript_id
WHERE c.practice = ?
  AND DATE(c.call_time) = ?
  AND (c.status = 'unanswered' OR c.status = 'missed')
ORDER BY c.call_time ASC
```

### 3. No callback yet (last 3 days)
```sql
-- Get all missed calls in last 3 days
SELECT call_id, call_time, caller_number, status
FROM calls
WHERE practice = ?
  AND DATE(call_time) BETWEEN ? AND ?
  AND direction = 'inbound'
  AND status != 'answered'
  AND (raw_meta NOT LIKE '%seed%' OR raw_meta IS NULL)
ORDER BY call_time DESC

-- Then check each for follow-up:
SELECT 1 FROM calls
WHERE practice = ?
  AND call_time > ?
  AND call_id != ?
  AND (caller_number = ? OR destination = ?)
LIMIT 1
```

### 4. Ad attribution with classifications
```sql
SELECT
  a.id, a.call_time, a.duration_sec, a.caller_number, a.campaign,
  a.matched_call_id,
  t.text AS transcript,
  cl.type, cl.confidence, cl.promised_callback, cl.promise_text
FROM ad_calls a
LEFT JOIN recordings r ON a.matched_call_id = r.id
LEFT JOIN transcripts t ON r.id = t.recording_id
LEFT JOIN classifications cl ON t.id = cl.transcript_id
WHERE DATE(a.call_time) = ? AND a.practice = ?
ORDER BY a.call_time
```

### 5. Ad spend yesterday
```sql
SELECT SUM(cost_gbp) AS total
FROM ad_spend
WHERE date = ? AND practice = ?
```

## Data Quality Issues (Surface in UI)

1. **44% practice attribution missing** - Show "Unattributed" filter/tab
2. **5.7% ad call match rate** - Most ad_calls have no transcript (render gracefully)
3. **65% transcription coverage** - Show "(not transcribed)" where NULL
4. **Junk "Totals" rows** - Always filter `WHERE call_time LIKE '2026-%'`
5. **Empty recording folders** - Some dates have no WAV files, show "(no audio)"

## Practice Codes

| Code | Display Name |
|------|--------------|
| `middleton` | Middleton |
| `cheadle` | Cheadle |
| `heald_green` | Heald Green |
| `heckmondwike` | Heckmondwike |
| `winsford` | Winsford |
| `NULL` | **(Unattributed)** |

## Phone Number Masking

Format: `+44 *** **** 1234` (show last 4 digits only)

Example from digest.js:
```javascript
function normalisePhone(n) {
  if (!n || n === '--') return '—';
  const d = String(n).replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('07')) {
    return d.slice(0,5) + ' ' + d.slice(5); // "07950 312637"
  }
  return String(n);
}
```

For UI masking:
```javascript
function maskPhone(n) {
  const d = String(n).replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('44')) {
    return `+44 *** **** ${d.slice(-4)}`;
  }
  return `*** ${d.slice(-4)}`;
}
```

## Reviews Database (Create This)

**Path:** `/home/maira/abra-comms-staging/data/reviews.db`

### Schema suggestion:

```sql
-- Tab 1: Callback actions
CREATE TABLE callback_actions (
  id INTEGER PRIMARY KEY,
  caller_number TEXT NOT NULL,
  practice TEXT,
  most_recent_missed_at TEXT NOT NULL,
  actioned_by TEXT,
  actioned_at TEXT,
  outcome TEXT,        -- called_back | vm_left | booked | wrong_number | not_relevant
  notes TEXT,
  UNIQUE(caller_number, most_recent_missed_at)
);

-- Tab 2: Ad call reviews
CREATE TABLE ad_call_reviews (
  id INTEGER PRIMARY KEY,
  ad_call_id INTEGER NOT NULL,     -- FK to ad_calls.id in comms.db
  reviewed_by TEXT,
  reviewed_at TEXT,
  decision TEXT,        -- new_patient | not_new_patient | booked | existing | spam_wrong
  notes TEXT,
  UNIQUE(ad_call_id)
);
```
