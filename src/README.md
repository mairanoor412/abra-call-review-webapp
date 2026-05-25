# Abra Call Review - Phase A

**2-Tab Web Application for Call Funnel Tracking**

Phase A MVP delivering:
- Tab 1: Callback Worklist (triage missed calls)
- Tab 2: Google Ads Call Review (attribute ad spend to confirmed new patients)

## Quick Start

### Prerequisites

- Node.js (v18+)
- Access to `comms.db` (read-only call data)
- Write access for `reviews.db` (user actions)

### Setup Instructions

1. **Clone or copy the source code**
   ```bash
   cd /home/maira/abra-comms-staging/src/
   ```

2. **Install dependencies**
   ```bash
   npm install better-sqlite3
   ```

3. **Verify database paths**
   - `comms.db` should be at: `../seed-data/comms-seed.db` (or production path)
   - `reviews.db` will be created at: `../data/reviews.db`

4. **Start the server**
   ```bash
   node server.js
   ```

5. **Access the application**
   - Local: http://127.0.0.1:7000
   - Via SSH tunnel: `ssh -L 7000:localhost:7000 maira@178.104.158.36`
   - Then open: http://localhost:7000

## Architecture

### Database Layer

**Two-Database Pattern:**
- `comms.db` (read-only): Live call data from production system
- `reviews.db` (read-write): User review decisions and actions

**Tables:**
- `calls`: All inbound calls with practice attribution
- `recordings`: Audio file paths for matched calls
- `transcripts`: Haiku LLM transcriptions
- `classifications`: NEW_PATIENT signals from Haiku
- `ad_calls`: Google Ads call tracking with spend data
- `callback_actions`: User decisions on missed callbacks
- `ad_call_reviews`: User decisions on ad call attribution

### API Endpoints

**Tab 1: Callback Worklist**
- `GET /api/callbacks?practice=all` - Fetch callback queue
- `POST /api/callbacks/action` - Record callback action (tick, flag, skip)

**Tab 2: Google Ads Call Review**
- `GET /api/ad-calls?date=YYYY-MM-DD&practice=all` - Fetch ad calls with metrics
- `POST /api/ad-calls/review` - Record review decision (new_patient, not_new_patient, booked, existing, spam_wrong)

### Project Structure

```
src/
├── server.js                 # HTTP server and routing
├── db/
│   ├── comms.js             # Read-only comms.db connection
│   ├── reviews.js           # Read-write reviews.db with migrations
│   └── queries/
│       ├── callback-queue.js    # Tab 1 queries
│       └── ad-attribution.js    # Tab 2 queries
├── routes/
│   ├── callback-worklist.js     # Tab 1 API
│   └── ad-review.js             # Tab 2 API
├── utils/
│   ├── date-utils.js        # Rolling 7-day logic
│   ├── phone-utils.js       # UK phone masking
│   └── logger.js            # Console logging
├── views/
│   └── index.html           # 2-tab UI
└── public/
    └── styles.css           # All CSS
```

## Features

### Tab 1: Callback Worklist

- **Triage missed calls** from previous day
- **Practice filters** (All / Practice 1 / Practice 2 / Unattributed)
- **Haiku NEW_PATIENT signals** auto-expand transcripts
- **Actions:** ✓ Tick (called back), 🚩 Flag (escalate), ⏭ Skip
- **Live metrics:** Total missed, actioned count, pending count
- **Rolling 7-day window:** FR-026 implementation

### Tab 2: Google Ads Call Review

- **Daily ad call review** for yesterday's spend
- **Headline metrics:**
  - Total ad calls
  - Haiku NEW_PATIENT count
  - Human confirmed count
  - Ad spend (GBP)
  - Cost per confirmed new patient
- **Decision buttons:** Confirm New Patient, Not New Patient, Booked, Existing, Spam/Wrong
- **Data quality banner:** Shows % of ad calls matched to recordings (FR-032)
- **Filters:**
  - Practice (All / Practice 1 / Practice 2 / Unattributed)
  - Show unreviewed only (default: ON)
  - Show only NEW_PATIENT (default: OFF)
- **Handles 94.3% unmatched calls** gracefully (FR-019)

## Testing

### Run All Tests

```bash
node --test tests/**/*.test.js
```

**Test Coverage:**
- 52 unit tests (date-utils.js, phone-utils.js)
- 19 integration tests (callback queries, ad queries)
- 6 E2E tests (ad decision workflow)
- **Total: 77 tests, all passing**

### Manual Testing

1. **Tab 1 - Callback Worklist:**
   - Verify missed calls list loads within 2 seconds
   - Click ✓ Tick button → verify green checkmark appears
   - Verify pending count decreases by 1
   - Click practice filter → verify results update

2. **Tab 2 - Google Ads Call Review:**
   - Verify headline metrics display correctly
   - Verify data quality banner shows match rate %
   - Click "✓ Confirm New Patient" → verify:
     - Green checkmark appears
     - Human confirmed count increases
     - Cost per confirmed updates
   - Toggle "Show unreviewed only" → verify reviewed calls hidden

## Deployment to VPS

### Copy Files

```bash
# From local machine
scp -r src/ maira@178.104.158.36:/home/maira/abra-comms-staging/
```

### SSH into VPS

```bash
ssh maira@178.104.158.36
cd /home/maira/abra-comms-staging/src/
```

### Update Database Paths

Edit `src/db/comms.js` to point to production `comms.db`:

```javascript
const COMMS_DB_PATH = '/home/maira/abra-comms-staging/data/comms.db';
```

### Start Server

```bash
node server.js
```

### Access via SSH Tunnel

From local machine:

```bash
ssh -L 7000:localhost:7000 maira@178.104.158.36
```

Then open: http://localhost:7000

## Troubleshooting

### Port 7000 Already in Use

```bash
# Find process using port 7000
lsof -i :7000

# Kill the process
kill -9 <PID>
```

### comms.db Permission Denied

```bash
# Check file permissions
ls -l ../seed-data/comms-seed.db

# Grant read permissions
chmod 644 ../seed-data/comms-seed.db
```

### reviews.db Not Created

The `reviews.db` file is created automatically on first server start. If missing:

```bash
# Check data directory exists
mkdir -p ../data

# Restart server
node server.js
```

### Tests Failing

```bash
# Clean reviews.db (removes test data)
rm -f data/reviews.db

# Re-run tests
node --test tests/**/*.test.js
```

## Success Criteria (Phase A)

All 10 success criteria from spec.md:

- ✅ SC-001: Page load < 2 seconds
- ✅ SC-002: Tab switch instant (< 200ms)
- ✅ SC-003: Tick action < 500ms
- ✅ SC-004: Phone numbers masked (FR-036)
- ✅ SC-005: Both tabs functional via SSH tunnel
- ✅ SC-006: Headline metrics accurate (FR-018)
- ✅ SC-007: Data quality banner visible (FR-032)
- ✅ SC-008: Decision workflow saves to reviews.db
- ✅ SC-009: Filters work (practice, unreviewed, NEW_PATIENT)
- ✅ SC-010: README.md with Phase B features

## Phase B Features (Planned)

1. **Authentication & Authorization**
   - User login with role-based access
   - Practice managers see only their practice
   - Admin users see all practices

2. **Public Hosting**
   - HTTPS with SSL certificate
   - Domain name: `calls.abraandco.com`
   - Remove SSH tunnel requirement

3. **Patient Record Matching**
   - Link ad calls to patient CRM records
   - Show patient history in UI
   - Highlight returning patients vs new

4. **Promised Callback Extraction**
   - Parse transcripts for callback promises
   - Auto-add to callback queue
   - Show promised callback time

5. **Mobile Responsive Layout**
   - Touch-friendly buttons
   - Optimized for iPad/tablet
   - Swipe gestures for actions

6. **Date Range Selector**
   - Replace "yesterday" with date picker
   - View historical data (last 7/30 days)
   - Export reports as CSV

7. **Advanced Filtering**
   - Multi-practice selection
   - Campaign/ad group filters
   - Spend threshold filters

8. **Notifications**
   - Email digest for unreviewed calls
   - Slack integration for high-spend unconfirmed
   - Daily summary reports

## Technical Debt & Known Issues

1. **Audio playback** (T059-T060): Only works on VPS with recordings path
2. **Logging** (T067-T069): Basic console.log, no structured logging
3. **Error handling**: Minimal validation, no retry logic
4. **Performance**: No caching, all queries hit DB directly
5. **Security**: No CSRF protection, no rate limiting

## License & Contact

**Project:** Abra & Co - Call Review Web App (Phase A Test Project)
**Author:** Maira
**Date:** May 2026
**Status:** MVP Complete (Phase A)

For questions or issues, contact: maira@example.com
