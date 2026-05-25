# Call Funnel Tracker Constitution

<!--
Sync Impact Report:
- Version: 1.0.0 → 1.1.0 (Phase A scope clarification)
- Ratification: 2026-05-21
- Last Amended: 2026-05-22
- Changes:
  * Principle II: Updated Phase A description (daily email → 2-tab web app)
  * Technology Stack: Clarified web UI focus, SQLite read-only + reviews.db write
  * Development Workflow: Corrected VPS workspace path (/home/maira/abra-comms-staging/)
  * Added UI/Frontend section for HTMX/React guidance
- Templates Status: ⚠ Pending - spec.md needs regeneration for web app
-->

## Core Principles

### I. Security-First Architecture
**MUST** protect sensitive patient data and API credentials.
- All API keys and secrets stored in `.env` (NEVER in code or git)
- Patient call data must be handled with privacy compliance
- Authentication required for all external API access
- Database encryption for stored call transcripts and patient information

**Rationale**: Working with UK healthcare practices requires strict data protection and GDPR compliance.

### II. Phase-Based Delivery
**MUST** complete Phase A before starting Phase B.
- Phase A: 2-tab web app (Callback Worklist + Google Ads Review) fully tested and deployed
- Phase B: Enhanced web app with auth, public hosting, patient record matching
- No feature creep - stick to defined phase scope
- Each phase must pass acceptance criteria (Phase A: 1 week to working version, team can use it Monday)

**Rationale**: Incremental delivery reduces risk and allows for course correction. SOW explicitly requires phased approach.

### III. Data-First Integration
**MUST** use existing data pipelines as primary source; avoid rebuilding upstream integrations.
- Read live SQLite database (`comms.db`) with read-only access
- Leverage existing Whisper transcriptions (35% coverage)
- Leverage existing Haiku classifications (new_patient, existing_patient, etc.)
- Surface data quality issues visibly (44% unattributed, 5.7% ad call match rate)
- Phase A: Read-only consumption; Phase B: May extend pipeline

**Rationale**: Phase A focuses on building human workflow UI on top of existing data. Don't rebuild what already works.

### IV. Test-First Development (TDD)
**MUST** write tests before implementation.
- Unit tests for business logic (callback queue filtering, deduplication)
- Integration tests for database queries (comms.db read, reviews.db write)
- End-to-end tests for UI workflows (tick callback → row greys, ad review → decision saves)
- Mock/seed data for development when live DB unavailable
- Minimum 70% code coverage (reduced from 80% for UI-heavy Phase A)

**Rationale**: Production system affects real business operations. Testing prevents bugs that impact customer experience.

### V. Observability & Monitoring
**MUST** provide visibility into system operations.
- Structured logging for all database queries and write operations
- Server startup/shutdown logs with timestamps
- User action tracking (callback ticked, ad review decision made)
- Data quality banners in UI (44% unattributed, 5.7% ad match rate, 65% no transcript)
- Console errors surfaced for debugging (Phase A: basic; Phase B: full alerting)

**Rationale**: Team needs to see data limitations and system health. Transparent surfacing builds trust in the tool.

### VI. Data Transparency & Human Workflow
**MUST** surface all data limitations and enable human decision-making.
- Phone numbers masked for privacy (+44 *** **** 1234 format)
- All data quality issues visible in UI (unattributed, no transcript, no match)
- No hiding of failed pipeline steps - show "(no transcript)", "(no audio)"
- Callback queue logic transparent: redirected calls rescued within 60s excluded
- Ad review UI shows full transcript for human validation of Haiku classifications

**Rationale**: Phase A replaces automated email with human-in-the-loop workflow. Trust requires transparency.

## Technology Stack

**Language & Runtime**:
- Node.js (LTS version) for backend server
- TypeScript for type safety (optional but recommended)

**Database**:
- SQLite (read-only): `comms.db` via symlink to live data
- SQLite (read-write): `reviews.db` for user actions (callback_actions, ad_call_reviews)
- Use `better-sqlite3` from `/home/abra/abra-comms/node_modules/`

**UI/Frontend**:
- HTMX or plain HTML/JS for fast shipping (React acceptable if faster for developer)
- Keep it light - Phase A is internal tool, no complex SPA needed
- Inline audio player for call recordings

**Reference Code**:
- Study `/home/abra/abra-comms/digest.js` for SQL query patterns (do NOT import or modify)
- Lift query logic, rebuild as web UI

**Development Tools**:
- Git for version control
- npm/yarn for dependency management
- Jest/Vitest for testing framework

## Development Workflow

**Local Development**:
- Develop locally on Windows machine (E:\maira\projects\test-project\Performance-Tracker\)
- Use mock/seed SQLite databases for testing when VPS unavailable
- Git commit regularly with descriptive messages
- Test queries against local seed data before VPS deployment

**VPS Development & Testing**:
- Code workspace: `/home/maira/abra-comms-staging/src/`
- Live data (read-only): `/home/maira/abra-comms-staging/data/comms.db` (symlink)
- Recordings (read-only): `/home/maira/abra-comms-staging/data/recordings/` (2.9 GB WAVs)
- Reviews DB (write): `/home/maira/abra-comms-staging/data/reviews.db` (you create)
- Reference code (read-only): `/home/abra/abra-comms/digest.js` (do NOT modify)
- Run server on `127.0.0.1:7000` (SSH tunnel access during Phase A)

**Code Quality Gates**:
- All tests must pass before deployment
- No hardcoded secrets or credentials
- Code reviewed (self-review acceptable for solo work)
- Linting and formatting standards applied

**Documentation**:
- README in `src/` with setup instructions
- List Phase B features at end of README (definition-of-done requirement)
- Deployment steps documented
- Troubleshooting guide for common errors

**Communication**:
- Daily 1-line status email to `sohail@armitageopticians.co.uk` cc `mairanoor412@gmail.com`
- Format: "What I did + What's blocking + ETA"
- Blockers reported same-day, no sitting on issues

## Governance

This constitution governs all development decisions for the Call Funnel Tracker project.

**Amendment Process**:
- Constitution changes require version bump (semantic versioning)
- Document rationale for any principle modifications
- Update dependent templates when principles change
- Commit constitution updates separately from feature work

**Compliance**:
- All specs, plans, and tasks must align with these principles
- Code reviews verify adherence to security and testing requirements
- Deployment checklist confirms observability and data accuracy

**Versioning**:
- MAJOR: Backward-incompatible principle removals or redefinitions
- MINOR: New principles added or materially expanded guidance
- PATCH: Clarifications, wording fixes, non-semantic refinements

**Version**: 1.1.0 | **Ratified**: 2026-05-21 | **Last Amended**: 2026-05-22
