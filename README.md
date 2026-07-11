<p align="center">
  <img src="docs/readme-hero-animated.svg" alt="LaunchCopilot — paste your store listing, get a graded, validated launch kit (ASO 27 → 93)" width="100%">
</p>

<p align="center">
  <a href="https://github.com/edycutjong/launchcopilot/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/edycutjong/launchcopilot/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="tests" src="https://img.shields.io/badge/tests-145%20passing-00d4ff?style=flat-square&labelColor=0d0221">
  <img alt="engine" src="https://img.shields.io/badge/ASO%20engine-28%20rules-ff2d95?style=flat-square&labelColor=0d0221">
  <img alt="stack" src="https://img.shields.io/badge/Next.js-Claude-8b00ff?style=flat-square&labelColor=0d0221">
  <img alt="semantic-release" src="https://img.shields.io/badge/release-semantic-e10079?style=flat-square&logo=semantic-release&labelColor=0d0221">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-00ffd1?style=flat-square&labelColor=0d0221">
</p>

> **Your app launched. Now make it found.** Paste your newly launched mobile app's store
> listing → get a graded ASO report (28 deterministic rules) and a complete, validated
> launch kit: rewritten store copy, a Product Hunt draft, a 7-day social calendar,
> community-matched posts, and press blurbs — in about a minute.

*Built for HackOnVibe (July 2026) — theme: **effective promotion of a newly launched mobile app.***

---

### 🛠️ Technical implementation
One flow — **Paste → Grade → Kit.** A deterministic **28-rule ASO lint engine** (pure
TypeScript, sub-millisecond, **130 unit tests** in CI) scores the pasted listing 0–100 with
per-field findings and fixes. A Claude pipeline then generates the launch kit and re-validates
its own ASO rewrite against the same engine. Ships with a free public API
(`POST /api/analyze`) and a CLI (`npm run aso-lint -- <listing.json>`).

### 🤖 AI functionality
Claude Opus synthesizes an app profile and writes channel-native copy for five surfaces at
once; the model's rewritten listing is **re-linted and auto-repaired until it scores ≥ 90** —
the AI is graded by the same deterministic judge as the human. A second model (Claude Haiku)
runs a **persona panel** that critiques every artifact in-character and regenerates the weak
ones. The keyword field is **machine-packed** from ranked candidates, so it's provably free
of duplicates, stop-words, and overflow.

### 👤 Problem & users
Solo indie developers ship good apps and get six downloads — not because the app is bad, but
because launch marketing (ASO budgets, Product Hunt mechanics, per-community rules) is a
specialist skill they can't buy at $2–5k. It **recurs**: every app update is a re-launch.
LaunchCopilot is the recurring companion for that loop.

### 💰 Business model
Free (3 kits/day, ~$0.40 COGS each) · Pro $12/mo (unlimited + relaunch campaigns) · Studio
$39/mo (agencies). Cheaper than ASO analytics suites, which report numbers but write nothing;
safer than raw ChatGPT, which silently breaks store rules.

### 🚀 Go-to-market
Launch on Product Hunt, r/SideProject and Indie Hackers — the exact channels the tool's own
community matcher recommends — plus a shareable "27 → 93" scorecard as an organic loop.

### 🎬 Presentation
Live demo + 5-minute video *(links added at submission)*. Try the engine locally with no API
key.

---

## Run it

```bash
npm install
npm test                                              # 130 unit tests
npm run aso-lint -- data/fixtures/pocketplants.json   # CLI: 27/100 (F) + fixes
npm run dev                                           # app at http://localhost:3000
```

**API** — grade any listing, no key required:
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H 'content-type: application/json' -d @data/fixtures/pocketplants.json
```

## 🧪 Testing & engineering harness

A **6-stage CI/CD pipeline** runs on every push (Quality → Security → Build → E2E →
Performance → Deploy gate). When it goes green on `main`, a separate **Release** workflow
runs [semantic-release](https://semantic-release.gitbook.io): it reads the conventional
commits, computes the next version, updates the changelog, and publishes a tagged GitHub
Release automatically.

```bash
npm run ci          # lint + typecheck + tests with coverage (the quality gate)
npm run e2e         # Playwright E2E (demo mode — no API key)
npm run release:dry # preview the next semantic version locally
```

| Layer | Tooling | Status |
|---|---|---|
| Code quality | ESLint + TypeScript strict | ✅ |
| Unit tests | Vitest — **130 tests, 98% line coverage** | ✅ |
| E2E tests | Playwright — 3 suites (smoke · API · responsive), desktop + mobile | ✅ |
| Security (SAST) | CodeQL | ✅ |
| Security (SCA) | Dependabot + `npm audit` | ✅ |
| Secret scanning | TruffleHog (verified) | ✅ |
| Performance | Lighthouse CI | ✅ |
| Releases | semantic-release (conventional commits → semver, auto GitHub Release) | ✅ |
| Community profile | CoC · Contributing · Security · issue/PR templates | ✅ 100% |

## Honest limitations
No auth yet · IP-based rate limits reset on redeploy · rules encode public ASO best
practices, not Apple's private ranking algorithm · English-only v1.

<sub>Design assets (synthwave theme) live in <code>docs/assets/</code> — run <code>npm run preview</code> there for the sanity check. Thank you for reviewing LaunchCopilot. — Edy</sub>
