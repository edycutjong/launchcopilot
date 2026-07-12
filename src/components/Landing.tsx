/**
 * Marketing landing section shown above the grader in the "input" phase.
 * Hero → how-it-works → what-you-get, then the live tool sits right below so the
 * whole page is the demo. Copy is drawn from SUBMISSION.md (real product claims).
 */

const STEPS: { n: string; label: string; title: string; body: string }[] = [
  {
    n: "01",
    label: "PASTE",
    title: "Drop a store link",
    body: "Paste your App Store or Google Play URL. We pull the title, subtitle, description, and screenshot count for you.",
  },
  {
    n: "02",
    label: "GRADE",
    title: "28-rule ASO engine",
    body: "A deterministic lint engine — no AI, pure encoded store rules — scores your listing 0–100 with per-field findings and exact fixes.",
  },
  {
    n: "03",
    label: "LAUNCH KIT",
    title: "Generate & validate",
    body: "Claude writes A/B store rewrites, a Product Hunt draft, a 7-day social calendar, community posts and press — each QA’d by a persona panel.",
  },
];

const KIT: { title: string; body: string }[] = [
  { title: "ASO scorecard", body: "0–100 with per-field findings and fixes" },
  { title: "A/B store rewrites", body: "each re-graded ≥90 by the same engine" },
  { title: "Product Hunt draft", body: "60-char tagline enforced" },
  { title: "7-day social calendar", body: "a narrative arc, not random posts" },
  { title: "Community posts", body: "never suggests subs that ban self-promo" },
  { title: "Press blurbs + cold email", body: "50/100-word, ready to send" },
];

function HeroGradeCard() {
  const bars: [string, number, string][] = [
    ["Title", 100, "#00d4ff"],
    ["Keywords", 86, "#00d4ff"],
    ["Subtitle", 63, "#ff6b35"],
    ["Description", 71, "#ff6b35"],
  ];
  return (
    <div className="relative mx-auto w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f0526]/70 p-6 shadow-[0_40px_90px_-45px_rgba(0,212,255,.55)]">
      <div className="mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em]">
        <span className="text-violet-300/60">ASO score</span>
        <span className="text-cyan-300/70">after rewrite</span>
      </div>
      <div className="flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
            <circle
              className="gauge-draw"
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="url(#hero-gauge)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray="326.7"
              strokeDashoffset="22.9"
            />
            <defs>
              <linearGradient id="hero-gauge" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#00d4ff" />
                <stop offset="1" stopColor="#ff2d95" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="pop-in text-3xl font-bold leading-none text-white">93</div>
              <div className="gradient-text mt-1 font-mono text-[11px] font-bold tracking-wide">GRADE A</div>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          {bars.map(([label, pct, color], i) => (
            <div key={label}>
              <div className="mb-1 flex justify-between font-mono text-[10px] text-violet-200/70">
                <span>{label}</span>
                <span>{pct}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="bar-grow h-full rounded-full"
                  style={{ width: `${pct}%`, background: color, animationDelay: `${0.55 + i * 0.12}s` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 flex items-center gap-1.5 border-t border-white/8 pt-4 font-mono text-[11px] text-violet-300/60">
        <span className="font-bold text-pink-400">34</span>
        <span aria-hidden>→</span>
        <span className="font-bold text-cyan-300">93</span>
        <span className="ml-auto">self-validated</span>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <section className="mb-10">
      {/* hero */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[.02] px-6 py-12 sm:px-10 sm:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <p className="rise rise-1 mb-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-300/80">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_12px_#00d4ff]" />
              ASO grader + launch kit · free, no API key to grade
            </p>
            <h1 className="rise rise-2 text-4xl font-bold leading-[1.02] tracking-tight text-white sm:text-6xl">
              Paste your store link. <span className="gradient-text">Get a graded launch kit.</span>
            </h1>
            <p className="rise rise-3 mt-5 max-w-xl text-base text-violet-100/75 sm:text-lg">
              LaunchCopilot grades your App Store or Google Play listing against 28 App Store Optimization
              rules, then generates a validated launch kit — store rewrite, Product Hunt, a 7-day social
              calendar, community posts, and press — in about a minute.
            </p>

            <div className="rise rise-4 mt-7 flex flex-wrap gap-3">
              {[
                ["28", "ASO rules"],
                ["34 → 93", "AI rewrite, self-validated"],
                ["0", "API keys to grade"],
              ].map(([stat, label]) => (
                <div
                  key={label}
                  className="card-hover rounded-2xl border border-white/10 bg-[#0f0526]/60 px-4 py-2.5"
                >
                  <span className="gradient-text font-mono text-lg font-bold">{stat}</span>
                  <span className="ml-2 text-xs text-violet-200/70">{label}</span>
                </div>
              ))}
            </div>

            <div className="rise rise-5 mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#grade-panel"
                className="btn-micro inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0d0221] transition hover:bg-white/85"
              >
                Grade my app <span aria-hidden>↓</span>
              </a>
              <span className="font-mono text-xs text-cyan-300/70">or paste a link below — or try an example</span>
            </div>
          </div>

          {/* right column: the product's signature output, so the hero isn't lopsided */}
          <div className="rise rise-4 hidden lg:block">
            <HeroGradeCard />
          </div>
        </div>
      </div>

      {/* how it works */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <div
            key={s.n}
            className="card-hover rise rounded-2xl border border-white/10 bg-white/[.03] p-5"
            style={{ animationDelay: `${0.15 + i * 0.1}s` }}
          >
            <div className="mb-3 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-cyan-300/90">{s.n}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-pink-400/80">{s.label}</span>
            </div>
            <div className="mb-1 text-sm font-semibold text-white">{s.title}</div>
            <p className="text-sm leading-relaxed text-violet-200/70">{s.body}</p>
          </div>
        ))}
      </div>

      {/* what you get */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-5 sm:p-7">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white">In every launch kit</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-violet-300/60">
            validated by the same engine that grades you
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {KIT.map((k, i) => (
            <div
              key={k.title}
              className="card-hover rise flex gap-3 rounded-xl border border-white/8 bg-black/20 p-3"
              style={{ animationDelay: `${0.1 + i * 0.07}s` }}
            >
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gradient-to-r from-cyan-400 to-pink-500" />
              <div>
                <div className="text-sm font-medium text-white/90">{k.title}</div>
                <div className="text-xs text-violet-200/60">{k.body}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-violet-300/60">
          Every generated artifact is critiqued by a persona panel synthesized from your own listing —
          weak ones regenerate automatically before you ever see them.
        </p>
      </div>
    </section>
  );
}
