# Feature Specification: Abra Call Review Web App

**Feature Branch**: `002-call-review-web-app`
**Created**: 2026-05-22
**Status**: Draft
**Input**: User description: "2-tab web app for Abra Call Review - Callback Worklist + Google Ads Review with human workflow UI"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ring Back Missed Callers (Priority: P1)

As a practice reception team member, I need to see all missed/unanswered calls from the last 2 days in one place so I can systematically ring everyone back and prevent lost patient opportunities.

**Why this priority**: Core workflow - prevents revenue loss from missed calls. Practice manager reported this as primary pain point.

**Independent Test**: Can be fully tested by creating test missed calls in database, opening Tab 1, verifying callback list appears correctly, ticking "Called back ✓", and confirming row greys out and moves to "Done today" section.

**Acceptance Scenarios**:

1. **Given** patient rang yesterday but call was unanswered, **When** I open Callback Worklist tab, **Then** I see their number (last 4 digits visible) with "Unanswered" badge and timestamp
2. **Given** patient rang 3 times from same number, **When** I view callback list, **Then** I see ONE row with "3 attempts" badge (not 3 separate rows)
3. **Given** I rang the patient back, **When** I tick "Called back ✓" and select outcome, **Then** row instantly greys and slides to "Done today" section
4. **Given** call was redirected but another extension answered within 60s, **When** I view callback list, **Then** that call does NOT appear (successfully handled)
5. **Given** 44% of calls have no practice attribution, **When** I view callback list, **Then** I see "Unattributed" filter chip with count

---

### User Story 2 - Validate Ad Call Quality (Priority: P1)

As a practice manager, I need to review every Google Ads call and confirm whether Haiku correctly classified it as a new patient, so I can calculate true ad ROI and identify misclassified calls.

**Why this priority**: Equal P1 - validates £spending effectiveness. SOW explicitly requires ad spend tracking and new patient confirmation.

**Independent Test**: Can be fully tested by creating test ad_calls with classifications in database, opening Tab 2, reviewing transcripts, clicking decision buttons, and verifying reviews.db stores human decisions correctly.

**Acceptance Scenarios**:

1. **Given** yesterday had 15 ad calls, **When** I open Google Ads Call Review tab, **Then** headline shows "15 ad calls, [X] Haiku said NEW, [Y] Human confirmed, £[Z] spend, £[W] per confirmed new patient"
2. **Given** Haiku classified call as NEW_PATIENT, **When** I view the row, **Then** transcript is expanded by default so I can read what caller said
3. **Given** I listen to call recording and read transcript, **When** I click "Confirm new patient ✓", **Then** decision saves to reviews.db and row shows green checkmark
4. **Given** only 5.7% of ad calls have matched recordings, **When** I view ad call with no match, **Then** row shows "(no transcript - pipeline match failed)" but still displays time/caller/duration/campaign
5. **Given** I need to focus on unreviewed calls, **When** I toggle "Show unreviewed only", **Then** reviewed rows hide instantly

---

### User Story 3 - Focus on High-Intent Missed Calls (Priority: P2)

As a receptionist, I want to see NEW PATIENT classified calls first in my callback list and know if they left a voicemail, so I prioritize high-value leads over routine calls.

**Why this priority**: P2 - enhances P1 story with intelligent sorting. Adds business value through prioritization but P1 delivers base functionality.

**Independent Test**: Can be tested by creating mix of missed calls with different Haiku classifications and voicemail lengths, verifying NEW_PATIENT badge appears in red, and confirming sort order (NEW first, then by VM length).

**Acceptance Scenarios**:

1. **Given** 20 missed calls with 2 classified NEW_PATIENT, **When** I open callback list, **Then** NEW_PATIENT calls appear at top with red badge
2. **Given** caller left 45-second voicemail, **When** I view their row, **Then** I see "45s VM" duration and first ~150 chars of transcript snippet
3. **Given** no transcript exists for missed call, **When** I view row, **Then** transcript column shows "(no transcript)" in muted grey

---

### User Story 4 - Per-Practice Filtering (Priority: P2)

As a multi-practice operations manager, I need to filter callback worklist and ad review by individual practice (Middleton, Cheadle, Heald Green, Heckmondwike, Winsford, Unattributed) so each location can focus on their own calls.

**Why this priority**: P2 - important for multi-practice orgs but not blocking for single-practice testing. Enhances usability significantly.

**Independent Test**: Can be tested by creating calls for different practices, clicking practice filter chips, and verifying only that practice's calls display.

**Acceptance Scenarios**:

1. **Given** I manage Middleton practice, **When** I click "Middleton" filter chip, **Then** callback list shows only Middleton calls (other practices hidden)
2. **Given** 44% of calls have practice=NULL, **When** I click "Unattributed" chip, **Then** list shows all unattributed calls with count badge
3. **Given** I'm viewing filtered list, **When** I click active filter chip again, **Then** filter clears and all practices show

---

### User Story 5 - Aged Callback Escalation (Priority: P3)

As a practice manager, I need to see calls older than 2 days in a separate "Aged" sub-tab so they don't get lost in today's queue and I can escalate follow-up.

**Why this priority**: P3 - quality-of-life feature. Prevents calls falling through cracks but P1/P2 deliver core workflow.

**Independent Test**: Can be tested by creating missed calls 3+ days old, verifying they appear in "Aged (>2 days)" sub-tab with red highlighting, and confirming they don't appear in "Today + Yesterday" tab.

**Acceptance Scenarios**:

1. **Given** call was missed 3 days ago, **When** I open Callback Worklist, **Then** default "Today + Yesterday" tab does NOT show it
2. **Given** I click "Aged (>2 days)" sub-tab, **When** aged calls display, **Then** rows have red background and show "3d ago" age label
3. **Given** I tick aged callback as complete, **When** row moves to "Done today", **Then** it clears from Aged tab

---

### User Story 6 - Audio Playback for Ad Calls (Priority: P3)

As a reviewer validating ad call classifications, I want to play the call recording inline (when matched_call_id exists) so I don't have to guess from transcript alone.

**Why this priority**: P3 - nice-to-have for 5.7% of ad calls with recordings. Transcript reading sufficient for Phase A.

**Independent Test**: Can be tested by creating ad_call with valid matched_call_id, opening Tab 2, clicking audio player icon, and hearing WAV playback.

**Acceptance Scenarios**:

1. **Given** ad call has matched recording, **When** I view row, **Then** audio player icon appears next to transcript
2. **Given** I click play, **When** audio loads, **Then** browser's native `<audio>` player plays WAV file from recordings/ path
3. **Given** no matched recording exists (94% of cases), **When** I view row, **Then** no audio player appears (graceful degradation)

---

### User Story 7 - Today+Yesterday Rolling Window (Priority: P2)

As a daily user, I want the "Today + Yesterday" callback list to automatically show rolling 2-day window (not calendar dates) so the list stays relevant as days change.

**Why this priority**: P2 - ensures tool stays evergreen without manual date selection. Important for daily workflow but not blocking MVP.

**Independent Test**: Can be tested by mocking system date changes and verifying callback list automatically includes calls from "now minus 2 days" without user intervention.

**Acceptance Scenarios**:

1. **Given** today is May 23, **When** I open callback list, **Then** I see calls from May 22-23 (rolling, not hardcoded dates)
2. **Given** I left tab open overnight, **When** date rolls to May 24, **Then** list auto-refreshes to show May 23-24 calls (May 22 moves to Aged)

---

### User Story 8 - Ad Review Date Range Selector (Priority: P3)

As an analyst, I want to select custom date range for ad call review (not just yesterday) so I can review historical campaigns and weekly trends.

**Why this priority**: P3 - Phase A default is "yesterday" per README. Historical review is Phase B enhancement.

**Independent Test**: Can be tested by adding date picker UI, selecting range, and verifying ad_calls query filters by selected dates.

**Acceptance Scenarios**:

1. **Given** I want to review last week's ads, **When** I select May 15-21 range, **Then** Tab 2 shows all ad calls from that week with aggregated spend
2. **Given** default on load, **When** Tab 2 opens, **Then** date range auto-fills to "yesterday" (not blank)

---

### Edge Cases

- **What happens when live comms.db is unavailable?** - App shows error banner "Cannot connect to call database - contact system admin" and disables UI interactions (read-only mode).
- **What happens when reviews.db write fails?** - Tick action shows inline error "Failed to save - retry?" with retry button. Does NOT grey row until save succeeds.
- **What happens when caller_number is NULL?** - Display shows "Unknown number" in masked phone field. Still create callback row if other criteria met.
- **What happens when same caller appears in both Today+Yesterday AND Aged tabs?** - Shouldn't happen - logic is mutually exclusive (<=2 days vs >2 days). If data corruption causes it, show in both with warning badge.
- **What happens when user ticks callback but forgets to select outcome?** - Outcome dropdown defaults to "Called back" if not explicitly chosen. Notes are optional.
- **What happens when 65% of calls have no transcript?** - Every "(no transcript)" row is perfectly valid - shows time/status/practice. Transcript is enhancement, not requirement.
- **What happens when ad_spend table has no row for yesterday?** - Headline cost shows "£0.00" with footnote "(no spend data for [date])". Doesn't break review workflow.
- **What happens when Haiku classification is "unclear"?** - Badge shows "UNCLEAR" in muted grey. Transcript still expanded if classification was new_patient OR unclear.

## Requirements *(mandatory)*

### Functional Requirements

#### Tab 1: Callback Worklist

**Data Retrieval & Filtering:**

- **FR-001**: System MUST query live SQLite database `comms.db` with read-only access to fetch missed/unanswered inbound calls from last 2 days
- **FR-002**: System MUST identify missed calls using these criteria:
  - `direction='inbound'` AND `call_time >= now()-2 days`
  - AND (`status='unanswered'` OR `status='answered' AND talking_sec < 10` OR `status='redirected'` with no successful answer within 60s)
- **FR-003**: System MUST exclude calls where outbound call to same caller_number exists after the missed inbound timestamp
- **FR-004**: System MUST exclude calls where callback_actions row exists in reviews.db for that caller_number since missed timestamp
- **FR-005**: System MUST deduplicate by caller_number (one row per unique number, aggregate attempt count)
- **FR-006**: System MUST join calls → recordings → transcripts → classifications to retrieve Haiku classification and transcript text

**Display & Sorting:**

- **FR-007**: System MUST display callback rows with: masked phone (+44 *** **** 1234), most recent missed time, practice, reason badge (Unanswered/Dropped/Redirected), attempt count (if >1), classification badge (NEW PATIENT in red, others muted), transcript snippet (~150 chars)
- **FR-008**: System MUST sort callback list: NEW_PATIENT classification first, then by talking_sec descending (longer voicemails = higher intent)
- **FR-009**: System MUST provide practice filter chips: Middleton, Cheadle, Heald Green, Heckmondwike, Winsford, Unattributed (44% of calls)
- **FR-010**: System MUST provide two sub-tabs: "Today + Yesterday" (default, rolling 2-day window) and "Aged (>2 days)" with red highlighting

**User Actions:**

- **FR-011**: System MUST provide "Called back ✓" tick button per row
- **FR-012**: System MUST provide outcome dropdown: Called back (default), Left VM, Booked appt, Wrong number, Not relevant
- **FR-013**: System MUST provide optional free-text notes field (max 500 chars)
- **FR-014**: System MUST write tick action to reviews.db → callback_actions table: caller_number, practice, most_recent_missed_at, actioned_at (now), outcome, notes
- **FR-015**: System MUST instantly grey row and slide to "Done today" section after successful write to reviews.db
- **FR-016**: System MUST show inline error with retry button if reviews.db write fails (do NOT grey row until save succeeds)

#### Tab 2: Google Ads Call Review

**Data Retrieval:**

- **FR-017**: System MUST query ad_calls table joined to recordings → transcripts → classifications for selected date range (default: yesterday)
- **FR-018**: System MUST calculate headline metrics for selected date:
  - Total ad calls (COUNT ad_calls)
  - Haiku-classified NEW patient count (COUNT where classification.type = 'new_patient')
  - Human-confirmed new patient count (COUNT ad_call_reviews where decision = 'new_patient')
  - Ad spend (SUM ad_spend.cost_gbp for date)
  - Cost per confirmed new patient (spend ÷ confirmed count)
- **FR-019**: System MUST handle 94.3% of ad_calls with matched_call_id = -1 (no recording) gracefully by showing "(no transcript - pipeline match failed)"

**Display:**

- **FR-020**: System MUST display ad call rows with: time (UTC), masked caller, duration (formatted as "2m 15s"), campaign name, Haiku classification badge, full transcript (expanded if new_patient OR unclear, collapsed otherwise), audio player (if matched_call_id > 0)
- **FR-021**: System MUST provide filters: date range picker (default yesterday), per-practice chips, "Show unreviewed only" toggle (default ON), "Show only NEW_PATIENT" toggle
- **FR-022**: System MUST visually distinguish reviewed rows with small green checkmark or muted opacity

**User Actions:**

- **FR-023**: System MUST provide decision buttons per row: "Confirm new patient ✓", "Not a new patient ✗", "Booked appt", "Already a patient", "Spam/wrong number"
- **FR-024**: System MUST provide optional outcome note field (e.g., "booked 14 May", "asked about contacts")
- **FR-025**: System MUST write decision to reviews.db → ad_call_reviews table: ad_call_id (FK to ad_calls.id), reviewed_at (now), decision, notes
- **FR-026**: System MUST update headline "Human confirmed" count in real-time as decisions are made

#### Database & Infrastructure

- **FR-027**: System MUST create reviews.db SQLite database on first run with schema:
  ```
  callback_actions: id (PK), caller_number, practice, most_recent_missed_at, actioned_by, actioned_at, outcome, notes, UNIQUE(caller_number, most_recent_missed_at)

  ad_call_reviews: id (PK), ad_call_id (FK), reviewed_by, reviewed_at, decision, notes, UNIQUE(ad_call_id)
  ```
- **FR-028**: System MUST bind web server to `127.0.0.1:7000` (localhost only, SSH tunnel access during Phase A)
- **FR-029**: System MUST use `better-sqlite3` module from `/home/abra/abra-comms/node_modules/` (already installed on VPS)
- **FR-030**: System MUST implement read-only connection to comms.db (via symlink `/home/maira/abra-comms-staging/data/comms.db`)
- **FR-031**: System MUST implement read-write connection to reviews.db at `/home/maira/abra-comms-staging/data/reviews.db`

#### Data Quality & Transparency

- **FR-032**: System MUST surface data quality banners in UI: "44% of calls have no practice attribution", "Only 5.7% of ad calls matched to recordings", "65% of calls not transcribed"
- **FR-033**: System MUST show "(no transcript)" in muted grey when transcript_text is NULL
- **FR-034**: System MUST show "(no audio)" when recording file path doesn't exist on disk
- **FR-035**: System MUST filter out junk rows with `call_time = "Totals"` using `WHERE call_time LIKE '2026-%'`
- **FR-036**: System MUST mask phone numbers: +44 *** **** [last4] for privacy

#### Logging & Observability

- **FR-037**: System MUST log server startup/shutdown with timestamps to console
- **FR-038**: System MUST log all database queries (comms.db reads, reviews.db writes) with execution time
- **FR-039**: System MUST log user actions: "Callback ticked for [masked_number]", "Ad review decision: [decision] for ad_call [id]"
- **FR-040**: System MUST display console errors in browser DevTools for debugging (Phase A acceptable; Phase B requires proper error UI)

### Key Entities

- **Callback Action**: User-initiated action marking a missed call as handled. Attributes: caller_number, practice, timestamp, outcome (called_back | vm_left | booked | wrong_number | not_relevant), notes
- **Ad Call Review**: Human validation of Haiku's classification for Google Ads calls. Attributes: ad_call_id (FK), decision (new_patient | not_new_patient | booked | existing | spam_wrong), timestamp, notes
- **Call Record (read-only)**: Existing 3CX call data. Attributes: call_id, call_time, practice, direction, status, caller_number, talking_sec, ringing_sec
- **Transcript (read-only)**: Whisper transcription of call recording. Attributes: recording_id (FK), text, language, confidence
- **Classification (read-only)**: Haiku AI categorization. Attributes: transcript_id (FK), type (new_patient | existing_patient | wrong_number | spam | unclear | personal | job_applicant), confidence, promised_callback flag
- **Ad Call (read-only)**: Google Ads call tracking event. Attributes: call_time, practice, campaign, caller_number, duration_sec, matched_call_id (FK to recordings, -1 if unmatched)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Team can access app via SSH tunnel to `localhost:7000` and see both tabs load within 2 seconds of page load
- **SC-002**: Callback Worklist tab displays all missed calls from last 2 days with one row per unique caller (no duplicates)
- **SC-003**: Ticking "Called back ✓" instantly greys row and moves to "Done today" section within 500ms (including database write)
- **SC-004**: Redirected calls that were answered by another extension within 60s do NOT appear in callback list (correct logic implementation)
- **SC-005**: Google Ads Review tab headline numbers reconcile: "Total ad calls" = COUNT(ad_calls), "Haiku said NEW" = COUNT(classifications where type='new_patient'), "Human confirmed" = COUNT(ad_call_reviews where decision='new_patient')
- **SC-006**: Ad calls with no matched recording (94.3%) render gracefully with "(no transcript - pipeline match failed)" message and still show time/caller/duration/campaign
- **SC-007**: Per-practice filter chips work correctly: clicking "Middleton" shows only Middleton calls, clicking "Unattributed" shows 44% with practice=NULL
- **SC-008**: "Show unreviewed only" toggle on Tab 2 hides reviewed rows instantly (client-side filtering, no page reload)
- **SC-009**: All 5 known data quality issues visible in UI: 44% unattributed, 5.7% ad match rate, 65% no transcript, junk "Totals" rows filtered, missing audio files labeled
- **SC-010**: Phase A README lists at minimum 5 Phase B features (auth, public hosting, patient record matching, promised callback extraction, mobile responsive layout)

## Out of Scope (Phase A)

These items are explicitly deferred to Phase B or later phases:

- **Authentication & Authorization**: Phase A is SSH-tunnel access only (localhost:7000). No login, no user roles.
- **Public Hosting**: Phase A runs on VPS localhost. Public URL with SSL comes Phase B.
- **Multi-User Concurrency**: Phase A single-user workflow. No conflict resolution if two people tick same callback.
- **Patient Record Matching**: `patients` table is empty. Linking calls to Optix patient records is Phase B.
- **Promised Callback Extraction**: digest.js has `fetchPromisedCallbacks` function. Surfacing "I'll call back at 2pm" promises is Phase B feature.
- **Mobile Responsive Layout**: Phase A desktop-only (team uses office computers). Mobile optimization Phase B.
- **Real-Time Refresh**: Phase A requires manual page reload to see new calls. WebSocket live updates Phase B.
- **Fixing Upstream Pipeline**: 44% unattributed, 5.7% ad match rate, 65% no transcript - these are UPSTREAM issues. Phase A surfaces them transparently; fixing classification/matching pipeline is separate project.
- **Killing digest.js Email**: Phase A runs alongside existing email digest. Only kill email after team confirms web app fully replaces it (Phase B decision).
- **Advanced Analytics**: Charts, trends, week-over-week comparisons - Phase B enhancements.
- **Export to CSV**: Phase A is interactive UI only. Data export features Phase B.

## Assumptions

1. **VPS Environment Ready**: `/home/maira/abra-comms-staging/` workspace exists with comms.db symlink, recordings/ symlink, and node_modules/ containing better-sqlite3
2. **Database Schema Stable**: comms.db schema (calls, recordings, recordings_v2, transcripts, classifications, ad_calls, ad_spend) matches sample_query.cjs output and digest.js queries
3. **SSH Tunnel Access**: During Phase A, Sohail accesses app via `ssh -L 7000:localhost:7000 maira@178.104.158.36` (SSH port forwarding)
4. **Browser Compatibility**: Team uses modern browsers (Chrome/Edge/Firefox) that support HTML5 `<audio>` element for WAV playback
5. **One Active User**: Phase A assumes single user workflow (no concurrent access conflicts)
6. **Daily Usage Pattern**: Tool used once per day (morning review), not real-time monitoring
7. **Recordings File Availability**: WAV files in `/home/maira/abra-comms-staging/data/recordings/YYYY-MM-DD/` may be missing (some dates empty per README). App handles gracefully with "(no audio)".
8. **Node.js LTS Available**: VPS has Node.js v18+ installed
9. **Timestamp Format**: All `call_time` fields in comms.db are ISO 8601 strings (e.g., "2026-05-21T16:18:24.097Z")
10. **Practice Codes**: Practice names are lowercase strings: middleton, cheadle, heald_green, heckmondwike, winsford (no typos/variations)
11. **Junk Row Filtering**: Filtering `WHERE call_time LIKE '2026-%'` is sufficient to exclude "Totals" rows and future-proof through 2026
12. **Redirect 60s Window**: Digest.js uses 60-second window to detect "redirected but answered elsewhere". Phase A replicates this exact logic.
13. **Phone Masking Privacy**: Last 4 digits sufficient for team to identify callers while protecting privacy (no full number display needed)
14. **Outcome Defaults Acceptable**: If user ticks callback without selecting outcome, defaulting to "Called back" is acceptable UX

## Dependencies

- **better-sqlite3 module**: Must be available at `/home/abra/abra-comms/node_modules/better-sqlite3` (already installed per README)
- **Live comms.db**: Read-only symlink at `/home/maira/abra-comms-staging/data/comms.db` must remain accessible
- **Recordings directory**: Read-only symlink at `/home/maira/abra-comms-staging/data/recordings/` with 2.9 GB WAV files
- **VPS Access**: User `maira` must retain SSH access to `178.104.158.36` with ACL permissions on comms.db and recordings/
- **Workspace Permissions**: `/home/maira/abra-comms-staging/src/` must have write access for code deployment
- **digest.js Reference**: Read-only access to `/home/abra/abra-comms/digest.js` for query pattern study (do NOT import or modify)
- **Node.js Runtime**: VPS must have Node.js LTS (v18+) installed and accessible in PATH
- **Port 7000 Availability**: Port 7000 on localhost must not be occupied by other services
