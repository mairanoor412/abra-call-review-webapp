# Scope of Work — Abra & Co Call-Funnel + Performance Dashboard

**Client:** Sohail Khan, CEO, Abra & Co (5 UK opticians: Cheadle, Heald Green, Middleton, Heckmondwike, Winsford).
**Owner of this doc:** Sohail (Claude wrote it from existing codebase + agreed direction 2026-05-19).
**Status:** for contractor onboarding. Forward this whole document — it answers the standard questions and sets acceptance criteria.

---

## 1. The objective in one sentence

Turn the current ad-centric daily call email into a trustworthy **full new-patient-intent funnel** — every inbound call (paid OR organic), transcribed, categorised, with destination always shown, and a per-practice **web-app worklist** the team uses to mark callbacks and that the bot then **auto-verifies** against 3CX outbound calls — and feed the Google Ads call rows into the `Marketing Report 2026` Google Sheet daily.

## 2. Context — what already exists (do NOT rebuild from scratch)

A working daily pipeline already runs on the Hetzner VPS (`abra-comms`, /home/abra/abra-comms, systemd `comms-ingest.timer` ~05:04 UTC). It currently does:

| Step | File | What it does |
|---|---|---|
| 1 | `scrapers/3cx.js` | Pulls yesterday's CDR via 3CX **admin API** (`{base}/xapi/v1/ReportCallLogData/Pbx.GetCallLogData`) into SQLite; also Playwright-scrapes recording WAVs. Groups segments by `MainCallHistoryId` (one real call = ~3-5 rows). |
| 2 | `scrapers/google_ads.js` | Pulls yesterday's ad calls + spend. ⚠️ `call_view` API returns area-code-only phone numbers; full numbers only from manual CSV export. |
| 3 | `transcribe.js` | **Whisper (local, API-free)** transcribes new recordings into SQLite. |
| 4 | `classify.js` | **Anthropic Haiku** classifier → `{type: new_patient|existing_patient|wrong_number|spam|job_applicant|personal|unclear, confidence, reasons, promised_callback}`. Overrides to `existing_patient` if caller phone matches the `patients` table (Optix-fed = source of truth). |
| 5 | `scripts/match-ad-calls.js` | Matches ad calls to recordings by time+practice; only INBOUND + human-answered (talk ≥ 8s, dest not VM/IVR/group) + recorded; else marks LOST. |
| 6 | `scripts/unified-digest.js` | Builds the daily "Abra & Co Daily Call Brief" email (the one Sohail receives at ~06:00). |
| 7 | (Monday) `scripts/weekly-ads-report.js` + `scripts/google-ads-optimizer.js` | Weekly ad report + AI optimiser. |

**Database:** SQLite, `better-sqlite3`, in `~/abra-comms/data/`. Tables: `calls`, `recordings`, `transcripts`, `classifications`, `ad_calls`, `patients` (Optix-fed via `Patient Transactions.csv` drop).

**Stack:** Node.js (ES modules), Playwright, better-sqlite3, `@anthropic-ai/sdk`, googleapis, dotenv. Email sent via Gmail API (shared OAuth with the personal-gmail-triage bot — fragile but working; see Constraints).

**3CX:** Tenant `https://asa.optixpbx.uk`, admin user `sohailkhan388@gmail.com` (GlobalAdmin). Auth: `POST {base}/webclient/api/Login/GetAccessToken` body `{Username,Password,SecurityCode:""}` → Bearer token on `/xapi/v1/...`. **Not** the OIDC `/connect/token` flow (returns 400).

⚠️ **The local copy at `C:\Users\Abra\abra-comms` is STALE vs the VPS.** The live `unified-digest.js` ("Daily Call Brief" format) is NOT in the local tree. **Pull from VPS first; do not edit locally and push.**

## 3. The problem we found (don't repeat these mistakes)

Concrete findings from the 2026-05-18 daily brief (Sohail caught these):

1. **"9 LOST / 0 reached a human" is wrong.** 5 of 9 ad calls were ANSWERED for 132–777s by humans on ext **321 "Heald Green, Dispensing"** and ext **312 "Heald Green, Reception 2 (HOL)"** — flagged LOST only because there's no recording. Root cause: 3CX recording is DISABLED on those extensions/queue. The bot conflates "no recording" with "no human." Fix the classifier, AND enable recording at source (see Step 0).
2. **No phone number on traced ad calls** — can't action, can't verify recovery.
3. **No "returned yes/no"** — the whole point of paying for these leads, and it's not shown.
4. **Headline-vs-list contradictions:** "15 to call back" but list sums to 14; "missed inbound 62" vs self-check "50 unanswered." Numbers must reconcile.
5. **Missing practices in the worklist:** Middleton/HG/Heckmondwike had missed counts but ZERO callback rows — unexplained (recovered? omitted? bug?).
6. **Ad-centric framing** — organic new-patient calls (no Maps/ad click) are invisible in the headline scorecard despite being real revenue.
7. **"No callback that day" is a fragile guess** — 3CX-only, single-day window, excludes withheld numbers, and an email can't hold state.

## 4. The agreed scope (3 phases — ship Step 0 + Phase A first)

### Step 0 — Ops (3CX config, not code) — Sohail/Anees, ~today
- 3CX admin → enable **call recording** on every inbound-answering extension / hunt-group / queue. Confirmed targets: ext **321** (Heald Green Dispensing), ext **312** (Heald Green Reception 2 "HOL"), the Reception 2 (HOL) group. **Audit ALL inbound-answering destinations across all 5 practices** and turn recording on everywhere it isn't already.
- Confirms or refutes the recording-off diagnosis.
- This unlocks Phase A — Whisper-everything is hollow if calls aren't recorded.

### Phase A — Fix the live daily brief + widen to all calls
Run on the **live VPS code** (pull first; back up first; see Constraints).

A1. **Reclassify** "answered ≥ ~30s, no recording" as `reached_human_recording_off` not `LOST`. New field, surfaced as a separate column.
A2. **Add `caller_number` to every traced ad-call row** in the email (currently missing). Use the 3CX-side number (full), not the Google Ads `call_view` area-code-only.
A3. **Add `returned: yes/no/n_a`** to every lost/missed row — cross-reference each against `calls` table for an outbound to that number in the next ~48h (or until appearance in the worklist as "called back"). The criterion for "returned" is **a verified outbound 3CX call placed to the caller's number**, not a team self-report.
A4. **Fix reconciliation:** subject/header count must equal listed rows; "missed inbound" total must equal the self-check count. Add a CI-style assertion in the digest builder so a mismatch fails loudly.
A5. **Widen classify to ALL recorded calls**, not just ad-matched. Surface organic `new_patient` calls in a new section above ad calls. The bot already classifies them — the email just doesn't show them. (Cost: Haiku ≈ pennies/day at ~300-450 calls/day.)
A6. **Destination is mandatory on every call row** in every section (ext/queue/VM name + number). Hard rule — never drop it.
A7. **Standing alert:** "Recording disabled on ext X — N answered ad calls this week not transcribable." Sticky until 3CX config is fixed.
A8. **Marketing Report 2026 integration** — append each day's ad-call rows (date, time, practice, caller_number, destination, talk_seconds, classified_type, returned_yes_no, ad_campaign, cost) to a dedicated tab in `Marketing Report 2026` Google Sheet. Idempotent: re-runs must dedupe, not duplicate. (Sheet ID — see Open Decisions.)

**Phase A acceptance:**
- Three consecutive days where headline numbers reconcile exactly with listed rows (CI assertion passes).
- For every ad call, the email shows phone number + destination + `returned y/n`.
- Organic `new_patient` calls (no ad match) appear in their own section.
- "Recording-off" alert visible until config is fixed.
- `Marketing Report 2026` tab has yesterday's ad-call rows by 07:00 UK time daily, no dupes.

### Phase B — Per-practice callback worklist web app + auto-verify
The email becomes the daily *alert* with a deep-link into the app; the **web app is the workspace of record**.

B1. **Per-practice login** (5 practices). Cheadle/HG/Middleton/Heckmondwike/Winsford each see their own list; Sohail sees all.
B2. **Worklist auto-built nightly** from the same SQLite the bot uses. Each row shows: caller_number, attempts, last try, **destination (always)**, where it ended, classified type, ad-or-organic, recording link if any.
B3. **Team actions per row:** Called back ✓ (logs who+when), Reached patient ✓, Booked ✓, Couldn't reach (attempt N), Notes.
B4. **Bot auto-verifies overnight** — cross-checks every "Called back ✓" against actual 3CX outbound calls to that number. Three buckets surfaced:
- ✅ Verified (team marked + outbound found)
- 🟡 Outstanding (no one has called back yet)
- 🔴 Claimed-but-no-outbound-found (team marked done but 3CX shows no outbound — flagged for review)
B5. **State persists** — no "that day" guesses. An item only closes when it's verified or explicitly snoozed/dismissed (with reason).
B6. **Audit log** — who marked what, when. Per-practice manager accountability.
B7. **Dashboard tab** — KPIs across the funnel: ad calls, organic new-patient calls, reached-human rate, recording coverage %, returned %, cost per new patient (from ads spend ÷ new patients booked), per-practice scorecards.

**Phase B acceptance:**
- Each practice manager can log in on a phone, see only their list, mark callbacks in ≤ 5 taps per item.
- Sohail's daily email links to Phase B and the numbers in the email match the numbers in the app (single source of truth).
- A "claimed but no outbound found" flag fires on test data and lands in Sohail's daily email.
- Closed items stay closed; outstanding items don't disappear at midnight.

## 5. Pre-filled answers to the contractor's onboarding questions

### Data access
- **Sample of the current email:** PDF on Sohail's desktop — *"Gmail - Abra Daily — 2026-05-18: 9 ad calls, 0 new patients, 9 lost, 15 to call back.pdf"*. This is the artefact to improve on.
- **Google Ads:** account owned by Sohail. Read-only API access via the existing `GOOGLE_ADS_*` env vars in `~/abra-comms/.env` on the VPS. To add the contractor: invite them as a read-only user on the Google Ads UI, or share the existing service-account-style creds. **Sohail's call — see Open Decisions.**
- **GA4 / GSC (organic SEO):** out of scope for this SoW (separate project). Mention only because organic new-patient calls show up here — but the **classifier** is what tags them as "organic new_patient", not GA4.
- **GMB / Google Business Profile insights:** **not currently in scope** of the comms bot. Mention if the contractor wants to add it in a later phase; do not block Phase A on it.

### Call recordings & transcriptions
- **Platform:** Whisper, running **locally on the VPS** (`transcribe.js`). API-free. Output rows in `transcripts` table.
- **Samples:** dump rows from `transcripts` joined to `recordings` + `classifications` — 10 examples on request. Available on VPS in SQLite, plus `samples/sample_transcripts.json` (fixture file for the classifier validator).
- **How "new patient" is identified:** Haiku classifier prompt in `classify.js` (system prompt + JSON schema reproduced in §6 below). **Phone override:** if `caller_number` matches `patients.phone_primary` or `phone_alt`, the result is forced to `existing_patient` regardless. Optix is the source of truth (fed via `Patient Transactions.csv` drop at `~/abra-comms/bots/ingest/data/`).

### Existing code
- **Repo:** `~/abra-comms/` on the VPS (Hetzner CX22, IP `178.104.158.36`). **Local clone is stale — work on VPS or pull fresh.** GitHub repo: see Open Decisions (Sohail may need to put it on GitHub for the contractor).
- **README:** `~/abra-comms/README.md` (basic).
- **Architecture map:** §2 of this doc.
- **DB schema:** read `lib/db.js`.
- **Important historical context:** see Sohail's project memory notes (paste-in summary in §7 below).

### Requirements
- **Tech stack:** existing pipeline is Node.js / SQLite / Anthropic SDK / Playwright — keep it. For Phase B web app, **recommend Node + Express + a small modern frontend (Preact or vanilla) on the same VPS behind nginx**, OR a Cloudflare Pages frontend that reads from a tiny API on the VPS. Match Sohail's existing **design tokens** (Abra cream/ink/lavender, large touch targets — mobile-first, opticians staff on phones/tablets). Avoid heavyweight SPAs.
- **Users:** Sohail (admin/all-practice view) + one manager per practice (5). ~10 users total to start. Magic-link or simple email/password is fine; no need for SSO.
- **KPIs to highlight (Phase B dashboard):** (1) New patients per day — split ad vs organic, (2) Reached-human rate per practice, (3) Recording coverage % per practice/extension, (4) Returned % within 24h / 48h, (5) Outstanding callback count per practice, (6) Cost per new patient (Google Ads spend ÷ booked new patients), (7) "Claimed but unverified" count.
- **Timeline:** Step 0 immediate (3CX config). Phase A: ~1 week. Phase B: ~2–3 weeks. Ship Phase A before Phase B starts — restoring trust in the daily email is more urgent than the app.

## 6. The current classifier (verbatim from `classify.js`)

```
type: "new_patient" | "existing_patient" | "wrong_number" | "spam" | "job_applicant" | "personal" | "unclear"
confidence: 0.0-1.0
reasons: ["short string", ...]
promised_callback: boolean
promise_text: "exact phrase if promised_callback else null"
```

Rules:
- `new_patient` = caller asking about pricing, availability, registering, or eye test for the first time.
- `existing_patient` = previous appointment, ordered glasses, prescription, current treatment.
- `wrong_number` = clearly meant for another business.
- `job_applicant` = employment / pre-reg position.
- `personal` = staff-to-staff with no business intent.
- `promised_callback` = staff EXPLICITLY promised to ring back.

Plus the **phone-override** rule: any caller_number matching `patients` table → forced `existing_patient`.

## 7. Critical operational rules (must-follow, learned the hard way)

- **3CX call log = SEGMENTS, not calls.** One real call ≈ 3-5 rows (group → receptionist → VM). ALWAYS group by `MainCallHistoryId` before counting attempts. Never quote 3CX row counts as call counts.
- **"No recording" ≠ "no human"** — record-coverage gaps are common (see §3). Classify those as a distinct state.
- **Withheld numbers** exist and can't be listed in callbacks — note them as a count, don't drop silently.
- **Verify before push:** predict numbers before shipping; cross-reference visible values; "pushed" ≠ verified. Reconciliation assertions in CI (see A4).
- **Backups first.** Before any edit on VPS: `cp file.js file.js.bak.YYYYMMDD`. Sohail keeps these as rollback.
- **Deploy by default** (Sohail's rule 2026-05-18): live deploy is the default unless explicitly testing; backup-first enables it. Do NOT silently sit on a finished change waiting for go.
- **Never delete VPS files or Gmail emails.** Drive 90-day auto-prune is OK; not VPS / Gmail.
- **Never quote 3CX row counts as call/attempt counts** (see SEGMENTS rule).
- **Don't trust the local `C:\Users\Abra\abra-comms` copy** — it's stale vs VPS.

## 8. Access & boundaries (for the contractor)

The contractor will need (Sohail to provision):
- **VPS SSH access** — `abra@178.104.158.36`, separate user or shared per Sohail's call. Read-write to `~/abra-comms` and the SQLite DB. Sudo: probably not.
- **3CX admin (read-only ideally)** — the contractor should pull CDR via the API recipe above, not log into 3CX UI day-to-day.
- **Google Ads** — read-only user invite on the account.
- **Marketing Report 2026 Google Sheet** — Editor access for the service account that will append daily rows.
- **Anthropic API key** — already in VPS `.env`; do not regenerate without coordinating.
- **Gmail send creds** — shared with personal-gmail-triage; do not rotate without a parallel rotation in both bots.
- **Optix** — out of scope; the contractor only sees the derived `patients` table on the VPS, not Optix itself.
- **GitHub:** if Sohail wants source control + PR workflow, create a private repo and seed from VPS. Otherwise contractor commits directly on VPS (less safe but matches current practice).

## 9. Constraints, gotchas, and what NOT to do

- **DO NOT auto-push to Sharjeel/Haadi apps** — those are separate projects with separate deploy rules.
- **DO NOT add new tabs to existing finance/marketing workbooks without explicit Sohail approval** (his rule). For the Marketing Report 2026 integration, ask which tab. See Open Decisions.
- **DO NOT replace the per-practice digest until Phase B is shipping** — Sohail still uses both.
- **The Gmail OAuth is fragile** — shared with the triage bot. If the contractor breaks it, both bots break.
- **`google_ads.js` has a number-corruption bug** (`07940` → `107940`) — known, not yet fixed. Don't trust the Google Ads side number; use the 3CX side for the full number.
- **Whisper throughput on a CX22 VPS at full call volume is unverified** — Phase A includes widening to all calls; the contractor should **measure transcription latency in week 1** and propose a smaller triage model + escalation if it bottlenecks.

## 10. Out of scope (this SoW)

- Optix integration changes
- Spec lens / contact lens reconciliation
- Recall command centre
- Sharjeel / Haadi children's apps
- SEO / GSC / GA4 work
- Telephony (3CX) carrier or hardware changes

## 11. Decisions taken (locked 2026-05-20)

1. **VPS access:** YES — provision a **separate user** for the contractor with read-write on `~/abra-comms` (no sudo). Sohail to create the account + share the SSH key out-of-band. Better audit trail than sharing the `abra` user.
2. **Source control:** **Private GitHub repo.** Sohail to create the repo and grant the contractor write access. **Initial step for the contractor:** SSH to VPS → seed the repo from `~/abra-comms` (`.gitignore` `.env`, `.bak.*`, `data/*.sqlite*`, `node_modules/`, recordings, .wrangler) → push to GitHub → all subsequent changes go via PR.
3. **Marketing Report 2026 sheet:** Sohail to share the Sheet URL/ID + Editor access for the service account. **Tab structure: propose-then-approve.** The contractor MUST NOT add a new tab without Sohail's explicit per-tab approval (Sohail's standing rule — never add tabs to existing workbooks unilaterally). Process: contractor proposes a tab name + column list in writing → Sohail approves in writing → contractor creates the tab and starts appending. Default proposal to start from: tab **`Ad Calls Daily`**, columns: `date, time, practice, caller_number, destination, talk_seconds, classified_type, returned_y_n, ad_campaign, ad_cost_gbp, call_id`. Append-only, idempotent on `call_id`.

---

*End of SoW. Tell the contractor: read this whole doc before asking questions. Their Q1 (data) is answered in §2 + §5. Q2 (recordings) in §6. Q3 (existing code) in §2 + §5. Q4 (requirements) in §5 + §8.*
