---
id: 001
title: Create Project Constitution
stage: constitution
date: 2026-05-21
surface: agent
model: claude-sonnet-4-5
feature: none
branch: master
user: maira
command: /sp.constitution
labels: ["initialization", "governance", "principles"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
  - .specify/memory/constitution.md
tests:
  - none (constitution is a governance document)
---

## Prompt

User requested creation of project constitution using /sp.constitution command for the Call Funnel Tracker system - a performance tracking application for UK optometry practices that integrates with 3CX phone system, Anthropic AI for call classification, and Google services for reporting.

Project context from SOW:
- Build from scratch (not modifying existing system)
- Phase A: Daily call brief system with 8 specific features (A1-A8)
- Phase B: Web app with callback worklist
- Integration-heavy: 3CX API, Whisper transcription, Anthropic Haiku classification, Google Ads, Google Sheets, Gmail
- Security-first (healthcare data, UK GDPR compliance)
- Develop locally, deploy to VPS
- Test-first approach required

## Response snapshot

Created comprehensive constitution (v1.0.0) with 6 core principles:

1. **Security-First Architecture**: API keys in .env, patient data privacy, GDPR compliance
2. **Phase-Based Delivery**: Complete Phase A before Phase B, no feature creep
3. **API-First Integration**: 6 external API integrations as primary data sources
4. **Test-First Development (TDD)**: Unit, integration, E2E tests, 80% coverage minimum
5. **Observability & Monitoring**: Structured logging, error tracking, self-diagnosis
6. **Data Accuracy & Reconciliation**: Fix specific bugs from SOW (phone numbers, reconciliation, all calls visible)

Additional sections:
- Technology Stack (Node.js, SQLite, TypeScript optional, API services)
- Development Workflow (local dev, VPS deployment, quality gates, documentation)
- Governance (amendment process, compliance, semantic versioning)

Constitution ratified 2026-05-21, stored at `.specify/memory/constitution.md`.

## Outcome

- ✅ Impact: Project foundation established with clear governance and technical principles aligned with SOW requirements
- 🧪 Tests: Constitution itself requires no tests (governance document)
- 📁 Files: Created `.specify/memory/constitution.md` (v1.0.0)
- 🔁 Next prompts: /sp.specify for Phase A spec, reply to Sohail for API credentials
- 🧠 Reflection: Constitution properly captures security, phasing, and integration requirements. Principles are specific and testable.

## Evaluation notes (flywheel)

- Failure modes observed: none
- Graders run and results (PASS/FAIL): Manual review - PASS (all placeholders filled, principles align with SOW)
- Prompt variant (if applicable): Standard /sp.constitution with project context
- Next experiment (smallest change to try): Create Phase A specification using /sp.specify
