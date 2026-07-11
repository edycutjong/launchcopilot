import LaunchCopilot from "@/components/LaunchCopilot";

export default function Home() {
  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(90% 60% at 50% 120%, rgba(255,107,53,.28), rgba(255,45,149,.16) 34%, transparent 60%)," +
            "radial-gradient(50% 55% at 12% 6%, rgba(139,0,255,.4), transparent 60%)," +
            "radial-gradient(55% 55% at 90% 14%, rgba(0,212,255,.24), transparent 60%)," +
            "linear-gradient(160deg,#160730,#0d0221 55%,#07010f)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            "linear-gradient(rgba(0,212,255,.08) 1px,transparent 1px) 0 0/100% 48px," +
            "linear-gradient(90deg,rgba(0,212,255,.06) 1px,transparent 1px) 0 0/48px 100%",
          maskImage: "linear-gradient(180deg,#000,transparent 70%)",
          WebkitMaskImage: "linear-gradient(180deg,#000,transparent 70%)",
        }}
      />
      <LaunchCopilot />
    </div>
  );
}
