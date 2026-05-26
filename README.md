# Abra Call Review - Phase A

A 2-tab web application for call funnel tracking at Abra dental practices.

## Overview

This application helps dental practice staff:
1. **Track missed calls** that need callbacks
2. **Review Google Ads call data** to validate Haiku AI classifications

Built for the AI Systems Operator position assessment at Abra & Co.

## Features

### Tab 1: Callback Worklist
- Shows missed/unanswered inbound calls from last 7 days (configurable in `date-utils.js`)
- Excludes calls already followed up
- Deduplicates by caller number with attempt count
- Actions: Called back, Left VM, Booked appt, Wrong number, Not relevant
- Filter by practice: Heald Green, Winsford, Middleton, Heckmondwike, Cheadle, Unattributed

### Tab 2: Google Ads Call Review
- Shows ad-sourced calls with campaign attribution
- Displays headline metrics:
  - Total ad calls
  - Haiku NEW patient count (AI classification)
  - Human confirmed count
  - Ad spend (requires `spend_gbp` in database)
  - Cost per confirmed new patient
- Warning banner showing match rate (5.7% of ad calls matched to recordings)
- Actions: Confirm New Patient, Not New Patient, Booked, Existing, Spam/Wrong
- Filter by date, practice (Heald Green, Winsford, Middleton, Heckmondwike, Cheadle), unreviewed only, NEW_PATIENT only

## Tech Stack

- **Backend:** Node.js with native HTTP server
- **Database:** SQLite3 (better-sqlite3)
  - `comms.db` - Read-only production data (calls, recordings, transcripts, classifications)
  - `reviews.db` - Write database for review actions
- **Frontend:** Vanilla HTML/CSS/JavaScript (no frameworks)

## Installation

```bash
# Clone the repository
git clone https://github.com/mairanoor412/abra-call-review-webapp.git
cd abra-call-review-webapp

# Install dependencies
npm install
```

## Usage

### Local Development
```bash
# Uses seed-data/comms-seed.db for testing
npm start
# Server runs at http://localhost:7000
```

### VPS Deployment
```bash
# SSH to VPS
ssh maira@178.104.158.36

# Navigate to project
cd /home/maira/abra-comms-staging

# Start server
node src/server.js
```

### Access via SSH Tunnel
```bash
# From local machine
ssh -L 7000:localhost:7000 maira@178.104.158.36

# Then open in browser
http://localhost:7000
```

## Project Structure

```
├── src/
│   ├── server.js              # HTTP server & routing
│   ├── db/
│   │   ├── comms.js           # Read-only connection to comms.db
│   │   ├── reviews.js         # Write connection to reviews.db
│   │   └── queries/
│   │       ├── callback-queue.js    # Tab 1 queries
│   │       └── ad-attribution.js    # Tab 2 queries
│   ├── routes/
│   │   ├── callback-worklist.js     # Tab 1 API endpoints
│   │   └── ad-review.js             # Tab 2 API endpoints
│   ├── views/
│   │   └── index.html         # Single-page application
│   ├── public/
│   │   └── styles.css         # Application styles
│   └── lib/
│       ├── phone-mask.js      # Phone number masking
│       ├── date-utils.js      # Date formatting utilities
│       └── logger.js          # Structured JSON logging
├── seed-data/
│   └── comms-seed.db          # Test database for local dev
├── tests/                     # Test suite (77 tests passing)
└── package.json
```

## API Endpoints

### Tab 1: Callback Worklist
- `GET /api/callbacks` - Fetch callback queue
- `POST /api/callbacks/:caller_number/action` - Record callback action

### Tab 2: Google Ads Review
- `GET /api/ad-calls` - Fetch ad calls with filters
- `POST /api/ad-calls/:id/review` - Record review decision

## Database Schema

### comms.db (Read-only)
- `calls` - All inbound/outbound calls
- `ad_calls` - Google Ads attributed calls
- `recordings_v2` - Call recordings metadata
- `transcripts` - Whisper transcriptions
- `classifications` - Haiku AI classifications

### reviews.db (Write)
- `callback_actions` - Tab 1 actions (caller_number, action, notes, actioned_at)
- `ad_call_reviews` - Tab 2 reviews (ad_call_id, decision, notes, reviewed_at)

## Demo Configuration

Current settings for demo purposes:
- **Tab 1 date filter:** 7 days (production: change to 2 days in `src/lib/date-utils.js` line 22)
- **Tab 2 default date:** 2026-05-18 (latest ad_calls data available)

## Data Limitations

As documented in requirements:
- **5.7% match rate** - Only 20 of 349 ad calls matched to recordings
- **94% without transcripts** - Most ad calls show "(no transcript - pipeline match failed)"
- **44% unattributed** - Many calls have no practice attribution
- **No spend data** - `spend_gbp` column not present in ad_calls table

These limitations are surfaced in the UI (warning banner, graceful handling).

## Testing

```bash
npm test
# 77 tests passing
```

## Author

**Maira Noor**
AI Systems Operator Assessment - Phase A
May 2026

## License

Proprietary - Abra & Co
