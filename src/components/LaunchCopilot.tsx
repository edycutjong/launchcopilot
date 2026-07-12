"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppListing, LintReport } from "@/lib/aso-lint";
import { ALL_RULES } from "@/lib/aso-lint";
import type { ListingPreview } from "@/lib/extract";
import type { Kit, KitEvent } from "@/lib/pipeline";
import type { Panel } from "@/lib/pipeline/schemas";
import { FIXTURE_META, FIXTURES, LINK_EXAMPLES } from "@/lib/fixtures";
import { ScoreDial } from "./ScoreDial";
import Landing from "./Landing";

type Phase = "input" | "graded" | "generating" | "kit";
const EMPTY: AppListing = {
  appName: "",
  platform: "ios",
  category: "",
  title: "",
  subtitle: "",
  keywords: "",
  shortDescription: "",
  description: "",
  whatItDoes: "",
};

const STAGE_LABELS: Record<string, string> = {
  profile: "App profile",
  aso: "Store listing (A/B + repair)",
  producthunt: "Product Hunt",
  social: "7-day social calendar",
  community: "Community posts",
  press: "Press blurbs",
  panel: "Persona-panel QA",
};
const STAGE_ORDER = ["profile", "aso", "producthunt", "social", "community", "press", "panel"];

function panelMean(panel: Panel, id: string): number | null {
  const v = panel.verdicts.find((x) => x.artifactId === id);
  if (!v) return null;
  const s = v.personaReactions.flatMap((r) => [r.specificity, r.hookStrength, r.channelFit]);
  return s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 : null;
}

export default function LaunchCopilot() {
  const [listing, setListing] = useState<AppListing>(EMPTY);
  const [report, setReport] = useState<LintReport | null>(null);
  const [phase, setPhase] = useState<Phase>("input");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<Record<string, "start" | "done">>({});
  const [asoLog, setAsoLog] = useState<string[]>([]);
  const [kit, setKit] = useState<Kit | null>(null);

  const set = (k: keyof AppListing, v: string) => setListing((l) => ({ ...l, [k]: v }));
  const fill = (patch: Partial<AppListing>) => setListing((l) => ({ ...l, ...patch }));

  const loadExample = (id: string) => {
    setListing(FIXTURES[id]);
    setReport(null);
    setPhase("input");
    setError(null);
  };

  const grade = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(listing),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Grading failed");
      setReport(await res.json());
      setPhase("graded");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Grading failed");
    } finally {
      setBusy(false);
    }
  }, [listing]);

  const generate = useCallback(async () => {
    setPhase("generating");
    setStages({});
    setAsoLog([]);
    setError(null);
    try {
      const res = await fetch("/api/kit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(listing),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? "Generation failed");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const f of frames) {
          const line = f.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const evt: KitEvent = JSON.parse(line.slice(6));
          if (evt.type === "stage") setStages((s) => ({ ...s, [evt.stage]: evt.status }));
          else if (evt.type === "aso_repair")
            setAsoLog((l) => [...l, `${evt.approach} · attempt ${evt.attempt} → ${evt.score}/100`]);
          else if (evt.type === "error") setError(evt.message);
          else if (evt.type === "done") {
            setKit(evt.kit);
            setPhase("kit");
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setPhase("graded");
    }
  }, [listing]);

  return (
    <div className="relative z-10 mx-auto w-full max-w-5xl px-5 py-10">
      <Header />
      {error && (
        <div className="mb-5 rounded-xl border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
          {error}
        </div>
      )}

      {phase === "input" && (
        <>
          <Landing />
          <InputForm listing={listing} set={set} onGrade={grade} busy={busy} onExample={loadExample} onAutofill={fill} />
        </>
      )}

      {(phase === "graded" || phase === "generating") && report && (
        <>
          <GradeReveal report={report} listing={listing} />
          {phase === "graded" ? (
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={generate}
                className="rounded-full bg-cyan-400 px-7 py-3 text-sm font-semibold text-[#04121a] shadow-[0_0_24px_#00d4ff66] transition hover:bg-cyan-300"
              >
                Generate my launch kit →
              </button>
              <button onClick={() => setPhase("input")} className="rounded-full border border-white/15 px-6 py-3 text-sm text-violet-200">
                Edit listing
              </button>
            </div>
          ) : (
            <StageTracker stages={stages} asoLog={asoLog} />
          )}
        </>
      )}

      {phase === "kit" && kit && <KitWorkspace kit={kit} onRestart={() => setPhase("input")} />}

      <Footer />
    </div>
  );
}

function ThemeToggle() {
  // CSS-driven: the visible glyph is chosen by `html.theme-light` (see globals.css),
  // so there's no React state — which sidesteps both a hydration mismatch and the
  // react-hooks/set-state-in-effect rule. The saved theme is applied pre-paint by a
  // tiny inline script in layout.tsx.
  const toggle = () => {
    const isLight = document.documentElement.classList.toggle("theme-light");
    try {
      localStorage.setItem("theme", isLight ? "light" : "dark");
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      onClick={toggle}
      aria-label="Toggle light and dark theme"
      title="Toggle theme"
      className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/12 text-base text-violet-200 transition duration-200 hover:-rotate-12 hover:border-cyan-400/50 hover:text-cyan-300"
    >
      <span className="theme-dark-only">☾</span>
      <span className="theme-light-only">☀</span>
    </button>
  );
}

function Header() {
  return (
    <header className="mb-8 flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" width={44} height={44} />
      <div>
        <div className="text-2xl font-bold tracking-tight">
          <span className="text-white">Launch</span>
          <span className="gradient-text">Copilot</span>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">
          Paste your store listing → graded launch kit
        </p>
      </div>
      <ThemeToggle />
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 pt-9">
      <div className="grid gap-8 sm:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <div className="mb-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={26} height={26} className="rounded-lg" />
            <span className="text-lg font-bold tracking-tight">
              <span className="text-white">Launch</span>
              <span className="gradient-text">Copilot</span>
            </span>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-violet-200/70">
            Paste your app&apos;s store link → a graded ASO report and a validated launch kit.
            Built for <b className="text-violet-100/85">HackOnVibe</b> 2026.
          </p>
        </div>
        <div>
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300/70 footer-head">Product</div>
          <ul className="space-y-2 text-sm text-violet-200/80">
            <li>
              <a href="#" className="transition hover:text-cyan-300">Grade a listing</a>
            </li>
            <li>
              <a href="/pitch" className="transition hover:text-cyan-300">Pitch deck</a>
            </li>
            <li>
              <a href="/api/analyze" className="transition hover:text-cyan-300">Free grading API</a>
            </li>
          </ul>
        </div>
        <div>
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300/70 footer-head">Source</div>
          <ul className="space-y-2 text-sm text-violet-200/80">
            <li>
              <a
                href="https://github.com/edycutjong/launchcopilot"
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-cyan-300"
              >
                GitHub <span className="lnk-arrow">↗</span>
              </a>
            </li>
            <li className="text-violet-300/70">
              CLI · <span className="font-mono text-violet-200/80">npx aso-lint</span>
            </li>
            <li>
              <a href="https://launchcopilot.edycu.dev" className="transition hover:text-cyan-300">
                launchcopilot.edycu.dev
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-2 border-t border-white/8 pt-5 pb-2 text-[11px] text-violet-300/60 sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 LaunchCopilot · MIT License · made by Edy</span>
        <span>App names, icons &amp; screenshots belong to their respective developers — shown for demonstration only.</span>
      </div>
    </footer>
  );
}

function Field({
  label,
  value,
  onChange,
  max,
  area,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  area?: boolean;
  placeholder?: string;
}) {
  const over = max !== undefined && [...value].length > max;
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-violet-200">{label}</span>
        {max !== undefined && (
          <span className={`font-mono text-[11px] ${over ? "text-pink-400" : "text-violet-400/60"}`}>
            {[...value].length}/{max}
          </span>
        )}
      </div>
      {area ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full resize-y rounded-lg border border-white/10 bg-[#0f0526] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border bg-[#0f0526] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60 ${over ? "border-pink-500/60" : "border-white/10"}`}
        />
      )}
    </label>
  );
}

function InputForm({
  listing,
  set,
  onGrade,
  busy,
  onExample,
  onAutofill,
}: {
  listing: AppListing;
  set: (k: keyof AppListing, v: string) => void;
  onGrade: () => void;
  busy: boolean;
  onExample: (id: string) => void;
  onAutofill: (patch: Partial<AppListing>) => void;
}) {
  const ios = listing.platform !== "android";
  const android = listing.platform !== "ios";
  const ready = listing.appName && listing.title && listing.description && listing.whatItDoes && listing.category;
  const overLimit =
    listing.title.length > 30 ||
    listing.description.length > 4000 ||
    (ios && (listing.subtitle ?? "").length > 30) ||
    (ios && (listing.keywords ?? "").length > 100) ||
    (android && (listing.shortDescription ?? "").length > 80);

  const [url, setUrl] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullMsg, setPullMsg] = useState<string | null>(null);
  const [pullWarn, setPullWarn] = useState<string[]>([]);
  const [pullErr, setPullErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<ListingPreview | null>(null);

  const autofill = async (pasted?: string) => {
    const link = (pasted ?? url).trim();
    if (!link) {
      setPullErr("Paste an App Store or Google Play link.");
      return;
    }
    setPulling(true);
    setPullErr(null);
    setPullMsg(null);
    setPullWarn([]);
    setPreview(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPullErr(json.error ?? "Couldn’t extract that listing.");
        return;
      }
      onAutofill(json.patch);
      setPullMsg(json.summary ?? "Filled from the store listing.");
      setPullWarn(json.warnings ?? []);
      setPreview(json.preview ?? null);
    } catch {
      setPullErr("Network error — please try again.");
    } finally {
      setPulling(false);
    }
  };

  const poolRef = useRef<HTMLDivElement>(null);
  // Show a random handful of examples on load (shuffled + subset) without a
  // hydration mismatch or setState-in-effect: the server renders the first few
  // (see .ex-pool in globals.css) and this effect re-picks/reorders via inline
  // styles only — pure DOM, so React never reconciles it.
  useEffect(() => {
    const el = poolRef.current;
    if (!el) return;
    const chips = Array.from(el.querySelectorAll<HTMLElement>("[data-ex]"));
    const idx = chips.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const shown = new Set(idx.slice(0, Math.min(9, chips.length)));
    chips.forEach((c, i) => {
      c.style.display = shown.has(i) ? "inline-flex" : "none";
      c.style.order = String(idx.indexOf(i));
    });
  }, []);

  return (
    <div id="grade-panel" className="scroll-mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-5 sm:p-7">
      <div className="mb-5 rounded-xl border border-cyan-400/25 bg-cyan-400/[.05] p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-cyan-200">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-cyan-400 text-[10px] font-bold text-black">↓</span>
          Paste a live App Store or Google Play link — we’ll fill the fields for you
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!pulling) autofill();
              }
            }}
            placeholder="https://apps.apple.com/…   or   play.google.com/store/apps/…"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0f0526] px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400/60"
          />
          <button
            onClick={() => autofill()}
            disabled={pulling}
            className="rounded-full bg-cyan-400 px-5 py-2 text-sm font-semibold text-[#04121a] transition enabled:hover:bg-cyan-300 disabled:opacity-50"
          >
            {pulling ? "Pulling…" : "Auto-fill"}
          </button>
        </div>
        {pullErr && <div className="mt-2 text-xs text-pink-300">{pullErr}</div>}
        {pullMsg && <div className="mt-2 text-xs text-cyan-200">{pullMsg}</div>}
        {pullWarn.length > 0 && <div className="mt-1 text-[11px] text-amber-300/80">{pullWarn.join(" ")}</div>}
        {preview && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
            {preview.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.icon} alt="" width={48} height={48} className="h-12 w-12 rounded-xl border border-white/10" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{preview.name}</div>
              <div className="font-mono text-[11px] text-violet-300/70">
                {preview.storeLabel}
                {preview.rating != null ? ` · ${preview.rating.toFixed(1)}★` : ""}
                {preview.installs ? ` · ${preview.installs}` : preview.ratingCount ? ` · ${preview.ratingCount.toLocaleString()}` : ""}
                {preview.category ? ` · ${preview.category}` : ""}
              </div>
            </div>
            {preview.screenshots.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {preview.screenshots.map((s, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={s} alt="" className="h-20 w-auto shrink-0 rounded-md border border-white/10" />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-5">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-xs text-violet-300/70">…or try an example</span>
          <span className="font-mono text-[10px] text-violet-400/60">
            {FIXTURE_META.length} sample listings graded A→F · randomised each visit ·{" "}
            <span className="text-cyan-300/70">↗ live</span> = real extraction
          </span>
        </div>
        <div ref={poolRef} className="ex-pool flex flex-wrap gap-2">
          {FIXTURE_META.map((f) => (
            <button
              key={f.id}
              data-ex
              onClick={() => onExample(f.id)}
              className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs text-white transition hover:border-cyan-400/50"
              title={f.blurb}
            >
              {f.emoji} {f.label}
            </button>
          ))}
          {LINK_EXAMPLES.map((l) => (
            <button
              key={l.url}
              data-ex
              onClick={() => {
                setUrl(l.url);
                autofill(l.url);
              }}
              className="rounded-full border border-cyan-400/30 bg-cyan-400/[.06] px-3 py-1.5 text-xs text-cyan-100 transition hover:border-cyan-400/60"
              title={`Live extraction · ${l.url}`}
            >
              {l.emoji} {l.label} <span className="text-cyan-300/70">↗ live</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="App name" value={listing.appName} onChange={(v) => set("appName", v)} placeholder="PocketPlants" />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-violet-200">Platform</span>
            <select
              value={listing.platform}
              onChange={(e) => set("platform", e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0f0526] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
            >
              <option value="ios">iOS</option>
              <option value="android">Android</option>
              <option value="both">Both</option>
            </select>
          </label>
          <Field label="Category" value={listing.category} onChange={(v) => set("category", v)} placeholder="Lifestyle" />
        </div>
        <Field label="Title" value={listing.title} onChange={(v) => set("title", v)} max={30} placeholder="PocketPlants" />
        {ios && (
          <Field label="Subtitle (iOS)" value={listing.subtitle ?? ""} onChange={(v) => set("subtitle", v)} max={30} />
        )}
        {ios && (
          <Field label="Keywords (iOS, 100-char field)" value={listing.keywords ?? ""} onChange={(v) => set("keywords", v)} max={100} />
        )}
        {android && (
          <Field label="Short description (Android)" value={listing.shortDescription ?? ""} onChange={(v) => set("shortDescription", v)} max={80} />
        )}
        <div className="sm:col-span-2">
          <Field label="Description" value={listing.description} onChange={(v) => set("description", v)} area max={4000} />
        </div>
        <div className="sm:col-span-2">
          <Field
            label="What does your app actually do? (one line — the AI uses this)"
            value={listing.whatItDoes}
            onChange={(v) => set("whatItDoes", v)}
            placeholder="Reminds you to water, fertilize and repot each houseplant"
          />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          disabled={!ready || busy || overLimit}
          onClick={onGrade}
          className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#0d0221] transition enabled:hover:bg-white/85 disabled:opacity-40"
        >
          {busy ? "Grading…" : "Grade my listing"}
        </button>
        <span className={`text-xs ${overLimit ? "text-pink-400" : "text-violet-300/60"}`}>
          {overLimit ? "Trim the fields over their character limit to grade." : "Free · no signup · no API key needed to grade"}
        </span>
      </div>
    </div>
  );
}

const FIELD_LABEL: Record<string, string> = {
  appName: "App name",
  title: "Title",
  subtitle: "Subtitle",
  keywords: "Keywords",
  shortDescription: "Short description",
  description: "Description",
  screenshots: "Screenshots",
  metadata: "Metadata",
  video: "Preview video",
  whatItDoes: "What it does",
};

/** Per-field score derived from the real rule weights: 1 − (field penalties / field max). */
function fieldScores(report: LintReport, platform: AppListing["platform"]) {
  const applic = (r: (typeof ALL_RULES)[number]) => r.store === "both" || platform === "both" || platform === r.store;
  const max: Record<string, number> = {};
  const lost: Record<string, number> = {};
  for (const r of ALL_RULES) if (applic(r)) max[r.field] = (max[r.field] ?? 0) + r.weight;
  for (const f of report.findings) lost[f.field] = (lost[f.field] ?? 0) + f.weight;
  return Object.keys(max)
    .map((field) => {
      const m = max[field];
      const l = Math.min(lost[field] ?? 0, m);
      return { field, pct: m > 0 ? Math.round((1 - l / m) * 100) : 100 };
    })
    .sort((a, b) => a.pct - b.pct);
}

function CriteriaBars({ report, platform }: { report: LintReport; platform: AppListing["platform"] }) {
  const rows = fieldScores(report, platform);
  if (rows.length === 0) return null;
  const color = (p: number) => (p >= 80 ? "#00d4ff" : p >= 50 ? "#ff6b35" : "#ff2d95");
  return (
    <div className="mt-6 rounded-xl border border-white/8 bg-black/20 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-cyan-300/80">Score by field</div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.field}>
            <div className="mb-1 flex items-baseline justify-between text-[12px]">
              <span className="text-violet-100/85">{FIELD_LABEL[r.field] ?? r.field}</span>
              <span className="font-mono" style={{ color: color(r.pct) }}>
                {r.pct}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#241147]">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${r.pct}%`, background: color(r.pct) }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GradeReveal({ report, listing }: { report: LintReport; listing: AppListing }) {
  const byField = useMemo(() => {
    const m = new Map<string, typeof report.findings>();
    for (const f of report.findings) {
      const arr = m.get(f.field) ?? [];
      arr.push(f);
      m.set(f.field, arr);
    }
    return [...m.entries()];
  }, [report]);
  const sev = { critical: "#ff2d95", warn: "#ff6b35", info: "#8fb7c8" } as const;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5 sm:p-7">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center">
          <ScoreDial score={report.score} grade={report.grade} />
          <p className="mt-2 text-sm font-medium text-white">{listing.appName || "Your listing"}</p>
        </div>
        <div className="flex-1">
          <h2 className="mb-1 text-lg font-semibold text-white">
            {report.grade === "A" || report.grade === "B" ? "Solid — a few tweaks left." : "Here's why the store can't find your app."}
          </h2>
          <p className="mb-4 text-sm text-violet-200/70">
            {report.findings.length} finding{report.findings.length === 1 ? "" : "s"} across {byField.length} field
            {byField.length === 1 ? "" : "s"}. Each one is fixable.
          </p>
          {Object.keys(report.fieldStats).length > 0 && (
            <div className="mb-5 grid gap-2 sm:grid-cols-2">
              {Object.entries(report.fieldStats).map(([field, s]) => (
                <div key={field}>
                  <div className="mb-0.5 flex justify-between text-[11px] text-violet-300/70">
                    <span className="capitalize">{field}</span>
                    <span className="font-mono">
                      {s.used}/{s.max}
                      {s.wasted > 8 ? ` · ${s.wasted} wasted` : ""}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#241147]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(100, (s.used / s.max) * 100)}%`, background: "linear-gradient(90deg,#ff2d95,#00d4ff)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CriteriaBars report={report} platform={listing.platform} />

      <div className="mt-5 space-y-3">
        {byField.map(([field, items]) => (
          <div key={field} className="rounded-xl border border-white/8 bg-black/20 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-300/80">{field}</div>
            <ul className="space-y-2">
              {items.map((f) => (
                <li key={f.ruleId} className="text-sm">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: sev[f.severity] }} />
                    <div>
                      <span className="text-white/90">{f.message}</span>
                      <div className="mt-0.5 text-xs text-violet-300/70">→ {f.fix}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageTracker({ stages, asoLog }: { stages: Record<string, "start" | "done">; asoLog: string[] }) {
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-6">
      <h3 className="mb-4 text-sm font-semibold text-white">Building your launch kit…</h3>
      <ol className="space-y-2.5">
        {STAGE_ORDER.map((s) => {
          const st = stages[s];
          return (
            <li key={s} className="flex items-center gap-3 text-sm">
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${
                  st === "done" ? "bg-cyan-400 text-black" : st === "start" ? "bg-violet-500/40 text-white" : "bg-white/10 text-white/40"
                }`}
              >
                {st === "done" ? "✓" : st === "start" ? "●" : ""}
              </span>
              <span className={st ? "text-white" : "text-white/40"}>{STAGE_LABELS[s]}</span>
              {s === "aso" && st === "start" && asoLog.length > 0 && (
                <span className="ml-2 font-mono text-[11px] text-cyan-300/70">{asoLog[asoLog.length - 1]}</span>
              )}
            </li>
          );
        })}
      </ol>
      {asoLog.length > 0 && (
        <div className="mt-4 rounded-lg bg-black/30 p-3 font-mono text-[11px] text-violet-300/70">
          <div className="mb-1 text-cyan-300/70">validator-in-the-loop:</div>
          {asoLog.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function KitWorkspace({ kit, onRestart }: { kit: Kit; onRestart: () => void }) {
  const tabs = ["Store listing", "Product Hunt", "Social", "Communities", "Press"] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]>("Store listing");
  const best = kit.aso.variants.reduce((a, b) => (b.lintAfter.score > a.lintAfter.score ? b : a));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-pink-400">{kit.lintBefore.score}</span>
          <span className="text-violet-400">→</span>
          <span className="font-mono text-2xl font-bold text-cyan-300">{best.lintAfter.score}</span>
          <span className="text-xs text-violet-300/60">
            ASO score · coverage {kit.coverageBefore}% → {best.coverageAfter}%
          </span>
          {kit.demoMode && (
            <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] text-violet-200">demo replay</span>
          )}
        </div>
        <button onClick={onRestart} className="rounded-full border border-white/15 px-4 py-2 text-xs text-violet-200">
          Grade another
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              tab === t ? "bg-cyan-400 text-[#04121a]" : "border border-white/12 text-violet-200 hover:border-cyan-400/40"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Store listing" && <AsoTab kit={kit} />}
      {tab === "Product Hunt" && <PhTab kit={kit} />}
      {tab === "Social" && <SocialTab kit={kit} />}
      {tab === "Communities" && <CommunitiesTab kit={kit} />}
      {tab === "Press" && <PressTab kit={kit} />}
    </div>
  );
}

function QaBadge({ kit, id }: { kit: Kit; id: string }) {
  const mean = panelMean(kit.panel, id);
  if (mean === null) return null;
  const good = mean >= 7;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: good ? "#0a2530" : "#2a0d1f", color: good ? "#00d4ff" : "#ff9ecb" }}
    >
      persona QA {mean}
    </span>
  );
}

function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      }}
      className="rounded-md border border-white/12 px-2 py-1 text-[11px] text-violet-200 hover:border-cyan-400/40"
    >
      {ok ? "copied ✓" : "copy"}
    </button>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-white/10 bg-white/[.03] p-4 ${className}`}>{children}</div>;
}

function AsoTab({ kit }: { kit: Kit }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-violet-300/70">
        <QaBadge kit={kit} id="aso" />
        <span>AI pick: <b className="text-cyan-300">{kit.aso.pick.approach}</b> — {kit.aso.pick.reason}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {kit.aso.variants.map((v) => (
          <Card key={v.approach} className={v.approach === kit.aso.pick.approach ? "ring-1 ring-cyan-400/50" : ""}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold capitalize text-white">{v.approach}</span>
              <span className="font-mono text-xs">
                <span className="text-pink-400">{kit.lintBefore.score}</span>
                <span className="text-violet-400"> → </span>
                <span className="text-cyan-300">{v.lintAfter.score}/{v.lintAfter.grade}</span>
                {v.repairAttempts > 0 && <span className="text-violet-400/60"> · {v.repairAttempts} repair</span>}
              </span>
            </div>
            {[
              ["Title", v.title],
              ["Subtitle", v.subtitle],
              ["Keywords", v.keywords],
              ["First fold", v.descriptionFirstFold],
            ].map(([k, val]) =>
              val ? (
                <div key={k} className="mb-2">
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-cyan-300/70">{k}</span>
                    <Copy text={String(val)} />
                  </div>
                  <p className="text-sm text-white/90">{val}</p>
                </div>
              ) : null,
            )}
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] text-violet-300/70">why this works</summary>
              <ul className="mt-1 space-y-1 text-xs text-violet-200/70">
                {v.rationale.map((r, i) => (
                  <li key={i}>
                    <b className="text-white/80">{r.field}:</b> {r.why}
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PhTab({ kit }: { kit: Kit }) {
  const p = kit.productHunt;
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <QaBadge kit={kit} id="producthunt" />
        <Copy text={`${p.tagline}\n\n${p.description}\n\n${p.makerFirstComment}`} />
      </div>
      <p className="text-lg font-semibold text-white">{p.tagline}</p>
      <p className="mt-2 text-sm text-violet-100/80">{p.description}</p>
      <div className="mt-3 text-[11px] uppercase tracking-wide text-cyan-300/70">Maker&apos;s first comment</div>
      <p className="text-sm text-violet-100/80">{p.makerFirstComment}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {p.topics.map((t) => (
          <span key={t} className="rounded-full border border-white/12 px-2 py-0.5 text-xs text-violet-200">
            {t}
          </span>
        ))}
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-violet-100/70">
        {p.launchDayChecklist.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
    </Card>
  );
}

function SocialTab({ kit }: { kit: Kit }) {
  return (
    <div className="space-y-3">
      <QaBadge kit={kit} id="social" />
      {kit.social.days.map((d, i) => (
        <Card key={i}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">
              {d.day} <span className="text-violet-300/60">· {d.theme}</span>
            </span>
            <Copy text={d.post + " " + d.hashtags.map((h) => (h.startsWith("#") ? h : "#" + h)).join(" ")} />
          </div>
          <p className="text-sm text-violet-100/90">{d.post}</p>
          <div className="mt-1 text-xs text-cyan-300/70">{d.hashtags.map((h) => (h.startsWith("#") ? h : "#" + h)).join(" ")}</div>
        </Card>
      ))}
    </div>
  );
}

function CommunitiesTab({ kit }: { kit: Kit }) {
  const policyColor = { open: "#00ffd1", scheduled: "#ff6b35", restricted: "#ffd66b", banned: "#ff2d95" } as const;
  return (
    <div className="space-y-3">
      <QaBadge kit={kit} id="community" />
      {kit.communities.map((c) => (
        <Card key={c.id}>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <a href={c.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-white hover:text-cyan-300">
              {c.name}
            </a>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: "#1a1030", color: policyColor[c.selfPromoPolicy] }}
              >
                {c.selfPromoPolicy === "scheduled" ? `post on ${c.bestDay}` : c.selfPromoPolicy}
              </span>
              <Copy text={`${c.postTitle}\n\n${c.postBody}`} />
            </div>
          </div>
          <p className="text-sm font-medium text-white/90">{c.postTitle}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-violet-100/80">{c.postBody}</p>
          <p className="mt-2 text-xs text-violet-300/60">{c.whyThisCommunity}</p>
        </Card>
      ))}
      <p className="text-center text-xs text-violet-400/50">
        Communities that ban self-promotion are never suggested.
      </p>
    </div>
  );
}

function PressTab({ kit }: { kit: Kit }) {
  const p = kit.press;
  return (
    <div className="space-y-3">
      <QaBadge kit={kit} id="press" />
      {[
        ["50-word blurb", p.blurb50],
        ["100-word blurb", p.blurb100],
      ].map(([k, v]) => (
        <Card key={k}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-cyan-300/70">{k}</span>
            <Copy text={v} />
          </div>
          <p className="text-sm text-violet-100/85">{v}</p>
        </Card>
      ))}
      <Card>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-cyan-300/70">Cold email to a blogger</span>
          <Copy text={`Subject: ${p.coldEmail.subject}\n\n${p.coldEmail.body}`} />
        </div>
        <p className="text-sm font-medium text-white/90">Subject: {p.coldEmail.subject}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-violet-100/80">{p.coldEmail.body}</p>
      </Card>
    </div>
  );
}
