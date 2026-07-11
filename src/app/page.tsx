import Image from "next/image";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      {/* backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 120%, rgba(255,107,53,.4), rgba(255,45,149,.22) 34%, transparent 62%)," +
            "radial-gradient(55% 60% at 15% 10%, rgba(139,0,255,.5), transparent 60%)," +
            "radial-gradient(60% 60% at 88% 24%, rgba(0,212,255,.3), transparent 60%)," +
            "linear-gradient(160deg,#160730,#0d0221 55%,#07010f)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "linear-gradient(rgba(0,212,255,.10) 1px,transparent 1px) 0 0/100% 46px," +
            "linear-gradient(90deg,rgba(0,212,255,.08) 1px,transparent 1px) 0 0/46px 100%",
          maskImage: "linear-gradient(180deg,transparent 58%,#000)",
          WebkitMaskImage: "linear-gradient(180deg,transparent 58%,#000)",
        }}
      />

      <main className="relative z-10 flex max-w-2xl flex-col items-center gap-7">
        <div className="flex items-center gap-4">
          <Image src="/icon.svg" alt="" width={72} height={72} priority unoptimized />
          <span className="text-5xl font-bold tracking-tight sm:text-6xl">
            <span className="text-white">Launch</span>
            <span
              style={{
                background: "linear-gradient(90deg,#00d4ff,#8b00ff 52%,#ff2d95)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Copilot
            </span>
          </span>
        </div>

        <p className="text-mono text-xs uppercase tracking-[0.25em] text-cyan-300/90">
          App-store optimizer × AI launch kit
        </p>

        <h1 className="text-balance text-2xl font-medium leading-snug text-white sm:text-3xl">
          Your app launched. Now make it found.
        </h1>
        <p className="max-w-xl text-pretty text-lg leading-relaxed text-violet-200/80">
          Paste your newly launched app&apos;s store listing → get a graded ASO report
          (28 deterministic rules) and a complete, validated launch kit — in about a minute.
        </p>

        <div
          className="flex items-center gap-4 rounded-full border border-white/15 bg-white/5 px-6 py-3 font-mono text-lg font-bold"
          role="img"
          aria-label="ASO score improves from 27 to 93"
        >
          <span className="text-white/60 text-sm">ASO SCORE</span>
          <span style={{ color: "#ff2d95" }}>27</span>
          <span className="text-violet-400">→</span>
          <span style={{ color: "#00d4ff" }}>93</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://github.com/"
            className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#0d0221] transition hover:bg-white/85"
          >
            View on GitHub
          </a>
          <a
            href="#api"
            className="rounded-full border border-cyan-400/50 px-6 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/10"
          >
            Grade a listing via API
          </a>
        </div>

        <p id="api" className="mt-2 max-w-xl font-mono text-xs leading-relaxed text-violet-300/60">
          The 28-rule ASO grader is live now — no API key needed:
          <br />
          <code className="text-cyan-300/80">
            curl -X POST /api/analyze -d @listing.json
          </code>
          <br />
          The full paste-to-kit flow (Claude pipeline + persona-panel QA) is wiring up.
        </p>
      </main>
    </div>
  );
}
