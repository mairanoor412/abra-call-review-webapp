# Implementation Plan: Abra Call Review Web App

**Branch**: `002-call-review-web-app` | **Date**: 2026-05-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-call-review-web-app/spec.md`

**Note**: This plan follows Spec-Driven Development (SDD) methodology. Phase 0-1 completed by `/sp.plan`, Phase 2 by `/sp.tasks`.

## Summary

Build a 2-tab web application for Abra & Co practice team to manage missed call callbacks and validate Google Ads call classifications. **Tab 1 (Callback Worklist)** displays missed/unanswered calls from last 2 days with human-in-the-loop ticking workflow. **Tab 2 (Google Ads Review)** enables manual validation of Haiku AI's new patient classifications to calculate true ad ROI.

**Technical Approach**: Lightweight Node.js web server reading existing SQLite database (`comms.db` read-only) and writing user actions to `reviews.db`. Use HTMX for interactivity (or plain HTML/JS) to minimize complexity. Lift SQL query patterns from existing `digest.js` reference code. Deploy to VPS at `localhost:7000` with SSH tunnel access (Phase A). No authentication, no public hosting, single-user workflow.

**Key Constraint**: Phase A = 1 week to working version team can use Monday. Focus P1 user stories (Callback + Ad Review core workflows), defer P2/P3 enhancements.

## Technical Context

**Language/Version**: Node.js LTS (v18+) - already installed on VPS per constitution
**Primary Dependencies**:
- `better-sqlite3` (from `/home/abra/abra-comms/node_modules/` - already installed, do NOT re-install)
- HTMX (via CDN) or plain HTML/JS for UI
- No framework required (Fastify/Express optional for routing if needed)

**Storage**:
- SQLite (read-only): `/home/maira/abra-comms-staging/data/comms.db` (symlink to live DB - 3,052 calls, transcripts, classifications)
- SQLite (read-write): `/home/maira/abra-comms-staging/data/reviews.db` (create on first run - stores callback_actions, ad_call_reviews)

**Testing**: Jest or Vitest for unit/integration tests (70% coverage target per constitution)

**Target Platform**: VPS Linux server at `178.104.158.36`, bind to `127.0.0.1:7000` (localhost only), SSH tunnel access

**Project Type**: Web application (backend + minimal frontend in single repo structure)

**Performance Goals**:
- Page load < 2 seconds (SC-001)
- Tick action < 500ms including DB write (SC-003)
- Support ~50-100 calls per day typical load (based on 3,052 calls total in sample DB)

**Constraints**:
- **Read-only access to comms.db** via ACL permissions (cannot modify live data)
- **Existing digest.js reference code** must not be imported or modified (read-only for query patterns)
- **No upstream pipeline changes** - must surface data quality issues transparently (44% unattributed, 5.7% ad match rate, 65% no transcript)
- **Phase A timeline**: 1 week to working version (per README)
- **No authentication** - SSH tunnel security only (Phase A)

**Scale/Scope**:
- 5 practices (Middleton, Cheadle, Heald Green, Heckmondwike, Winsford) + Unattributed
- ~771 dropped calls last 7 days (from sample_query.cjs)
- ~349 ad calls total (20 matched to recordings = 5.7%)
- Single active user (practice manager/reception team member)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Security-First Architecture
- ✅ **Phone number masking**: FR-036 requires "+44 *** **** [last4]" format (privacy compliance)
- ✅ **Read-only DB access**: ACL permissions prevent modification of live comms.db
- ✅ **No secrets in code**: Constitution mandates `.env` for credentials (though Phase A has none - SSH tunnel only)
- ✅ **UK GDPR compliance**: Patient call data handled with privacy (masked phones, no full number display)

### Principle II: Phase-Based Delivery
- ✅ **Phase A scope locked**: 2-tab web app per spec, no feature creep
- ✅ **1 week timeline**: Spec focus on P1 stories (Callback + Ad Review), defer P2/P3
- ✅ **Acceptance criteria clear**: SC-001 through SC-010 measurable
- ✅ **Phase B deferred**: 11 out-of-scope items documented (auth, public hosting, patient matching, mobile, real-time, analytics, CSV export)

### Principle III: Data-First Integration
- ✅ **Read existing pipeline**: Leverage comms.db (calls, transcripts, classifications) without rebuilding
- ✅ **Surface data quality**: FR-032 requires UI banners for 44% unattributed, 5.7% ad match, 65% no transcript
- ✅ **No upstream fixes**: Phase A explicitly excludes fixing classification/matching pipeline (Out of Scope)
- ✅ **Graceful degradation**: FR-019, FR-033, FR-034 handle missing transcripts/audio/spend data

### Principle IV: Test-First Development (TDD)
- ✅ **70% coverage target**: Constitution allows reduced coverage for UI-heavy Phase A
- ✅ **Unit tests planned**: Callback queue filtering (FR-002-006), deduplication (FR-005), phone masking (FR-036)
- ✅ **Integration tests planned**: comms.db read queries, reviews.db write operations (FR-014, FR-025)
- ✅ **E2E tests planned**: Tick callback → row greys (FR-015), ad review decision → save (FR-025)
- ⚠️ **Mock/seed data needed**: Constitution requires testing when live DB unavailable (create seed comms.db for local dev)

### Principle V: Observability & Monitoring
- ✅ **Structured logging**: FR-037 (server startup/shutdown), FR-038 (DB queries with timing), FR-039 (user actions)
- ✅ **Data quality banners**: FR-032 surfaces limitations in UI
- ✅ **Console errors**: FR-040 allows DevTools debugging (Phase A acceptable)
- ✅ **User action tracking**: Log every tick, decision, filter change

### Principle VI: Data Transparency & Human Workflow
- ✅ **Phone masking**: FR-036 privacy format
- ✅ **Visible limitations**: FR-032-034 show "(no transcript)", "(no audio)", "(no spend data)"
- ✅ **Callback logic transparent**: FR-002 documents redirect rescue logic (60s window)
- ✅ **Ad review UX**: FR-020 expands transcripts for human validation (NEW_PATIENT/unclear auto-expand)

**GATE RESULT**: ✅ **PASS** - All principles satisfied. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/002-call-review-web-app/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/sp.plan output)
├── research.md          # Phase 0 output (to be created)
├── data-model.md        # Phase 1 output (to be created)
├── quickstart.md        # Phase 1 output (to be created)
├── contracts/           # Phase 1 output (to be created)
│   ├── api.md           # REST endpoints if needed
│   └── database.sql     # reviews.db schema
└── tasks.md             # Phase 2 output (/sp.tasks - NOT created by /sp.plan)
```

### Source Code (VPS workspace)

**VPS workspace root**: `/home/maira/abra-comms-staging/`

```text
/home/maira/abra-comms-staging/
├── data/                         # Data directory (read-only except reviews.db)
│   ├── comms.db                  # SYMLINK to live DB (read-only via ACL)
│   ├── recordings/               # SYMLINK to 2.9 GB WAVs (read-only via ACL)
│   └── reviews.db                # USER CREATES - writable SQLite for actions
├── src/                          # CODE WORKSPACE (write access)
│   ├── server.js                 # Main Node.js server (Fastify/Express/http)
│   ├── db/
│   │   ├── comms.js              # Read-only comms.db connection
│   │   ├── reviews.js            # Read-write reviews.db connection + migrations
│   │   └── queries/
│   │       ├── callback-queue.js # Tab 1 query (lifted from digest.js fetchCallbackQueue)
│   │       ├── no-callback.js    # Tab 1 exclusion logic (fetchNoCallbackYet pattern)
│   │       └── ad-attribution.js # Tab 2 query (fetchAdAttribution pattern)
│   ├── lib/
│   │   ├── phone-mask.js         # Phone masking utility (+44 *** **** 1234)
│   │   ├── date-utils.js         # Rolling 2-day window, aged calculation
│   │   └── logger.js             # Structured logging (FR-037-039)
│   ├── routes/
│   │   ├── callback-worklist.js  # Tab 1 endpoints (GET list, POST tick)
│   │   └── ad-review.js          # Tab 2 endpoints (GET list, POST decision)
│   ├── views/                    # HTML templates (or HTMX partials)
│   │   ├── index.html            # 2-tab shell
│   │   ├── tab1-callbacks.html   # Callback worklist UI
│   │   └── tab2-ads.html         # Ad review UI
│   ├── public/                   # Static assets
│   │   ├── styles.css            # Minimal styling
│   │   └── htmx.min.js           # HTMX CDN fallback (or link CDN in HTML)
│   ├── README.md                 # Setup instructions + Phase B feature list (SC-010)
│   └── package.json              # Dependencies (do NOT include better-sqlite3 - use existing)
├── tests/                        # Test suite
│   ├── unit/
│   │   ├── phone-mask.test.js    # FR-036 masking
│   │   ├── date-utils.test.js    # Rolling window logic
│   │   └── queries.test.js       # Query logic with seed DB
│   ├── integration/
│   │   ├── comms-db.test.js      # Read queries against seed comms.db
│   │   └── reviews-db.test.js    # Write operations to test reviews.db
│   └── e2e/
│       ├── callback-tick.test.js # SC-003: tick → grey in 500ms
│       └── ad-decision.test.js   # FR-025: decision → save + checkmark
├── seed-data/                    # Mock database for local dev
│   └── comms-seed.db             # Minimal seed data (10 calls, transcripts, classifications)
└── sample_query.cjs              # REFERENCE ONLY (from VPS README - read pattern)
```

**Local Development** (`E:\maira\projects\test-project\Performance-Tracker\`):

```text
E:\maira\projects\test-project\Performance-Tracker\
├── .specify/                     # SpecKit Plus config
├── specs/002-call-review-web-app/ # This feature's docs
├── src/                          # SYMLINK or COPY of VPS src/ for local dev
├── tests/                        # Test suite
└── seed-data/                    # Seed databases for local testing
```

**Structure Decision**:

**Single repository, web app structure** with backend+frontend in `src/`. Backend handles DB queries + REST endpoints, frontend is minimal HTML/HTMX (no SPA complexity). Code deployed to VPS `/home/maira/abra-comms-staging/src/` via Git push or direct edit.

**Rationale**:
- Phase A is internal tool, single-user, no need for backend/frontend split
- Constitution prioritizes "fast shipping" - plain HTML/HTMX faster than React setup
- Existing `better-sqlite3` in `/home/abra/abra-comms/node_modules/` - require from path, don't re-install
- Local dev uses seed DB, VPS testing uses live data via symlinks

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**Status**: ✅ No violations - complexity tracking table not needed.

All constitution principles satisfied:
- Security: Phone masking, read-only ACL, privacy compliance
- Phase-based: 1-week scope locked, Phase B deferred
- Data-first: Read existing pipeline, surface quality issues
- TDD: 70% coverage, unit/integration/e2e tests planned
- Observability: Logging, banners, console errors
- Transparency: All limitations visible, graceful degradation

No additional complexity introduced beyond spec requirements.

---

## Phase 0: Research

**Status**: ⏸️ **Pending** (to be executed next)

### Research Tasks

Based on Technical Context, no major NEEDS CLARIFICATION items. However, research needed for:

1. **HTMX vs Plain HTML/JS Decision**
   - Research: Best practices for minimal interactivity (tick button → grey row, toggle filters)
   - Alternatives: HTMX (declarative), Alpine.js (lightweight), Plain JS (no deps)
   - Decision criterion: Fastest to ship, smallest learning curve

2. **Fastify vs Express vs http.createServer**
   - Research: Minimal routing for 4-5 endpoints (Tab 1 list/tick, Tab 2 list/decision)
   - Alternatives: Fastify (fast but learning curve), Express (familiar), http module (zero deps)
   - Decision criterion: Fastest to ship, no over-engineering

3. **better-sqlite3 Connection Patterns**
   - Research: How to require module from `/home/abra/abra-comms/node_modules/` path
   - Study: `digest.js` db.js connection setup (lines 1-20 likely)
   - Decision: Replicate connection pattern, separate read-only + read-write connections

4. **Seed Database Creation**
   - Research: Minimal seed data structure for local testing
   - Requirements: 10 calls (5 missed, 2 NEW_PATIENT, 3 different practices), 3 transcripts, 5 classifications, 5 ad_calls (1 matched)
   - Output: `seed-data/comms-seed.db` with schema matching live DB

5. **Reviews DB Migration Strategy**
   - Research: How to create `reviews.db` on first run with FR-027 schema
   - Alternatives: Manual SQL file, migration library (overkill), inline SQL in code
   - Decision: Inline SQL in `db/reviews.js` - check if tables exist, create if not

**Output**: `research.md` documenting all decisions + rationale

---

## Phase 1: Design & Contracts

**Status**: ⏸️ **Pending** (after Phase 0 complete)

### 1.1 Data Model (`data-model.md`)

**Entities**:

#### reviews.db (writable)

**callback_actions** (Tab 1 user actions)
```sql
CREATE TABLE callback_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caller_number TEXT NOT NULL,
  practice TEXT,                        -- middleton, cheadle, NULL for unattributed
  most_recent_missed_at TEXT NOT NULL,  -- ISO 8601 timestamp
  actioned_by TEXT,                     -- Phase A: null (no auth), Phase B: user email
  actioned_at TEXT NOT NULL,            -- ISO 8601 timestamp (now)
  outcome TEXT NOT NULL,                -- called_back | vm_left | booked | wrong_number | not_relevant
  notes TEXT,                           -- Optional free text (max 500 chars - app validates)
  UNIQUE(caller_number, most_recent_missed_at) -- Prevent duplicate ticks for same missed call
);
CREATE INDEX idx_callback_caller ON callback_actions(caller_number);
CREATE INDEX idx_callback_time ON callback_actions(most_recent_missed_at);
```

**ad_call_reviews** (Tab 2 user decisions)
```sql
CREATE TABLE ad_call_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad_call_id INTEGER NOT NULL,          -- FK to comms.db ad_calls.id
  reviewed_by TEXT,                     -- Phase A: null (no auth), Phase B: user email
  reviewed_at TEXT NOT NULL,            -- ISO 8601 timestamp (now)
  decision TEXT NOT NULL,               -- new_patient | not_new_patient | booked | existing | spam_wrong
  notes TEXT,                           -- Optional outcome note (e.g., "booked 14 May")
  UNIQUE(ad_call_id)                    -- One review per ad call
);
CREATE INDEX idx_review_ad_call ON ad_call_reviews(ad_call_id);
```

#### comms.db (read-only reference)

**Key tables** (schema from README + sample_query.cjs):

- **calls**: Master CDR (call_id, call_time, practice, direction, status, caller_number, talking_sec, ringing_sec)
- **recordings** + **recordings_v2**: call_id → filename mapping
- **transcripts**: recording_id → text (Whisper output)
- **classifications**: transcript_id → type (new_patient, existing_patient, wrong_number, spam, unclear, personal, job_applicant), confidence
- **ad_calls**: Google Ads events (id, call_time, practice, campaign, caller_number, duration_sec, matched_call_id)
- **ad_spend**: Daily cost (date, practice, campaign, cost_gbp)

**Validation Rules** (from spec FRs):

- FR-036: Phone masking - last 4 digits only visible (+44 *** **** 1234)
- FR-013: Notes max 500 chars (app validates, DB allows TEXT)
- FR-014: Outcome ENUM validation (5 values)
- FR-025: Decision ENUM validation (5 values)
- FR-035: Filter junk rows `WHERE call_time LIKE '2026-%'`

**State Transitions**:

**Callback row states**:
1. `pending` (initial): Appears in callback list
2. `actioned` (after tick): Row exists in callback_actions → greys + moves to "Done today"

**Ad call row states**:
1. `unreviewed` (initial): No row in ad_call_reviews
2. `reviewed` (after decision): Row exists in ad_call_reviews → green checkmark + muted opacity

### 1.2 API Contracts (`contracts/`)

**REST Endpoints** (if using Fastify/Express):

```markdown
# contracts/api.md

## Tab 1: Callback Worklist

### GET /api/callbacks
Returns callback queue for selected practice + date range.

**Query Params**:
- `practice` (optional): middleton | cheadle | heald_green | heckmondwike | winsford | unattributed | all (default)
- `aged` (optional): true | false (default) - if true, return >2 days old only

**Response** (200 OK):
```json
{
  "callbacks": [
    {
      "caller_number": "07950312637",          // Full number (backend only - mask in UI)
      "masked_phone": "+44 *** **** 2637",
      "practice": "winsford",                  // or null
      "most_recent_missed_at": "2026-05-21T16:17:27.931Z",
      "status": "unanswered",                  // unanswered | dropped | redirected
      "attempt_count": 3,
      "classification_type": "new_patient",    // or null if no classification
      "transcript_snippet": "Hi, I'd like to book an eye test...", // or null
      "talking_sec": 45,                       // for VM duration
      "days_since": 1                          // for aged tab
    }
  ],
  "total_count": 23,
  "unattributed_count": 10
}
```

### POST /api/callbacks/tick
Mark callback as actioned.

**Request Body**:
```json
{
  "caller_number": "07950312637",
  "most_recent_missed_at": "2026-05-21T16:17:27.931Z",
  "practice": "winsford",                     // can be null
  "outcome": "called_back",                   // ENUM: called_back | vm_left | booked | wrong_number | not_relevant
  "notes": "Booked for May 25 3pm"            // optional, max 500 chars
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "actioned_at": "2026-05-22T10:15:00.000Z"
}
```

**Error** (400 Bad Request):
```json
{
  "error": "Invalid outcome value",
  "valid_outcomes": ["called_back", "vm_left", "booked", "wrong_number", "not_relevant"]
}
```

**Error** (500 Internal Server Error):
```json
{
  "error": "Failed to save callback action",
  "message": "UNIQUE constraint failed: callback_actions.caller_number"
}
```

---

## Tab 2: Google Ads Call Review

### GET /api/ad-calls
Returns ad calls for review with headline metrics.

**Query Params**:
- `date` (optional): YYYY-MM-DD (default: yesterday)
- `practice` (optional): same as Tab 1
- `unreviewed_only` (optional): true (default) | false
- `new_patient_only` (optional): true | false (default)

**Response** (200 OK):
```json
{
  "headline": {
    "total_ad_calls": 15,
    "haiku_new_patient_count": 8,
    "human_confirmed_count": 5,
    "ad_spend_gbp": 45.67,
    "cost_per_confirmed": 9.13          // spend / confirmed (or null if confirmed = 0)
  },
  "ad_calls": [
    {
      "ad_call_id": 123,
      "call_time": "2026-05-21T14:30:00.000Z",
      "caller_number": "07941007206",
      "masked_phone": "+44 *** **** 7206",
      "duration_sec": 135,
      "duration_formatted": "2m 15s",
      "campaign": "Map - Call Ads | Cheadle",
      "practice": "cheadle",
      "matched_call_id": -1,                   // or valid recording ID
      "has_transcript": false,                 // 94.3% false
      "transcript_text": null,                 // or string
      "classification_type": "new_patient",    // or null if no match
      "classification_confidence": null,       // or 0-1 float
      "is_reviewed": false,
      "review_decision": null,                 // or decision string if reviewed
      "review_notes": null
    }
  ]
}
```

### POST /api/ad-calls/review
Submit human decision for ad call.

**Request Body**:
```json
{
  "ad_call_id": 123,
  "decision": "new_patient",               // ENUM: new_patient | not_new_patient | booked | existing | spam_wrong
  "notes": "Booked for May 25"             // optional
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "reviewed_at": "2026-05-22T10:20:00.000Z"
}
```

**Error** (400 Bad Request):
```json
{
  "error": "Invalid decision value",
  "valid_decisions": ["new_patient", "not_new_patient", "booked", "existing", "spam_wrong"]
}
```
```

### 1.3 Quickstart Guide (`quickstart.md`)

**Content**:
1. **Prerequisites**: Node.js v18+, SSH access to VPS, Git
2. **Local Development Setup**:
   - Clone repo
   - `cd E:\maira\projects\test-project\Performance-Tracker\`
   - Use `seed-data/comms-seed.db` for testing
   - Run `npm test` (70% coverage target)
3. **VPS Deployment**:
   - SSH: `ssh maira@178.104.158.36`
   - `cd /home/maira/abra-comms-staging/src/`
   - Copy code from local or Git push
   - `node server.js` (binds to 127.0.0.1:7000)
4. **Access App**:
   - SSH tunnel: `ssh -L 7000:localhost:7000 maira@178.104.158.36`
   - Browser: `http://localhost:7000`
5. **Troubleshooting**:
   - Port 7000 occupied: `lsof -i :7000` and kill process
   - comms.db permission denied: Check ACL with `getfacl /home/maira/abra-comms-staging/data/comms.db`
   - reviews.db not created: Check `src/db/reviews.js` migration logic

### 1.4 Agent Context Update

Run: `.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude`

**Technologies to add**:
- Node.js v18
- better-sqlite3
- HTMX (or Alpine.js / Plain JS - pending Phase 0 decision)
- Fastify/Express (pending Phase 0 decision)
- Jest/Vitest for testing

---

## Phase 2: Task Breakdown

**Status**: ⏸️ **NOT STARTED** (requires `/sp.tasks` command after Phase 1 complete)

**Output**: `tasks.md` with testable, atomic tasks for implementation

**Recommended task groups** (for `/sp.tasks` to generate):

1. **Infrastructure Setup**
   - Create `reviews.db` migration
   - Setup comms.db read-only connection (require from `/home/abra/abra-comms/node_modules/better-sqlite3`)
   - Create seed database for local dev

2. **Query Implementation** (lift from digest.js)
   - Callback queue query (FR-001-006)
   - No-callback-yet exclusion logic (FR-003-004)
   - Ad attribution query (FR-017-019)
   - Headline metrics calculation (FR-018)

3. **Tab 1: Callback Worklist**
   - GET /api/callbacks endpoint
   - POST /api/callbacks/tick endpoint
   - HTML/HTMX UI: callback list, tick button, outcome dropdown, notes field
   - Practice filter chips
   - Today+Yesterday vs Aged sub-tabs
   - "Done today" section

4. **Tab 2: Google Ads Review**
   - GET /api/ad-calls endpoint
   - POST /api/ad-calls/review endpoint
   - HTML/HTMX UI: ad call list, decision buttons, notes field
   - Headline metrics display
   - "Show unreviewed only" toggle
   - Audio player (if matched_call_id > 0)

5. **Utilities & Shared Logic**
   - Phone masking function (FR-036)
   - Date utils (rolling 2-day window, aged calculation)
   - Structured logger (FR-037-039)

6. **Testing**
   - Unit tests: phone-mask, date-utils, query logic
   - Integration tests: comms.db reads, reviews.db writes
   - E2E tests: tick → grey (SC-003), decision → save

7. **Documentation**
   - README in `src/` with setup instructions
   - List Phase B features (SC-010 requirement)

---

## Next Steps

1. ✅ **Constitution Check**: PASSED (no violations)
2. ⏳ **Phase 0**: Execute research tasks → generate `research.md`
3. ⏳ **Phase 1**: Create `data-model.md`, `contracts/`, `quickstart.md`, update agent context
4. ⏳ **Phase 2**: Run `/sp.tasks` to generate `tasks.md` with testable implementation tasks
5. ⏳ **Implementation**: Execute tasks in priority order (P1 stories first)

**Command to proceed**: User runs `/sp.tasks` after reviewing this plan.

**Estimated effort**:
- Phase 0-1 (planning): 2-4 hours
- Phase 2 (task generation): 1 hour
- Implementation: 3-5 days for P1 stories (1 week total including testing/debugging per timeline)

**Critical path**:
1. Setup reviews.db + connections (Day 1)
2. Lift digest.js queries (Day 1-2)
3. Build Tab 1 core (Day 2-3)
4. Build Tab 2 core (Day 3-4)
5. Testing + deployment (Day 4-5)
6. Buffer for bugs/polish (Day 6-7)
