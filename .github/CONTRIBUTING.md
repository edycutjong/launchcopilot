# Contributing

Thanks for your interest in improving LaunchCopilot! 🎉

## Getting Started
1. Fork the repo and branch from `main`: `git checkout -b feat/your-feature`
2. Install dependencies: `npm install`
3. Copy the env template: `cp .env.example .env.local` (optional — the ASO grader runs with no keys)
4. Start the dev server: `npm run dev`

## Before You Open a PR
- `npm run ci` passes (lint, typecheck, tests with coverage).
- `npm run e2e` passes (Playwright, demo mode).
- Add or update tests for any behavior change — the 28-rule ASO engine is fully unit-tested; keep it that way.
- Keep commits conventional (`feat:`, `fix:`, `docs:`, `chore:`).

## Reporting Bugs / Requesting Features
Open an issue using the provided templates. Include repro steps, expected vs.
actual behavior, and environment details.
