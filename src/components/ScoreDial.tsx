import type { Grade } from "@/lib/aso-lint";

const GRADE_COLOR: Record<Grade, string> = {
  A: "#00d4ff",
  B: "#00ffd1",
  C: "#ffd66b",
  D: "#ff6b35",
  F: "#ff2d95",
};

export function ScoreDial({ score, grade, size = 168 }: { score: number; grade: Grade; size?: number }) {
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const color = GRADE_COLOR[grade];
  // 270° gauge, open at the bottom.
  const arc = 0.75;
  const dash = c * arc;
  const filled = dash * (score / 100);
  return (
    <div style={{ width: size, height: size }} className="relative">
      <svg width={size} height={size} className="rotate-[135deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#241147"
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke-dasharray .9s cubic-bezier(.2,.8,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-5xl font-bold text-white tabular-nums">{score}</span>
        <span className="text-xs text-violet-300/70">/ 100</span>
        <span className="mt-1 text-lg font-bold" style={{ color, textShadow: `0 0 12px ${color}` }}>
          {grade}
        </span>
      </div>
    </div>
  );
}
