import LaunchCopilot from "@/components/LaunchCopilot";

export default function Home() {
  return (
    <div className="relative flex-1 overflow-hidden">
      <div aria-hidden className="app-bg pointer-events-none fixed inset-0" />
      <div aria-hidden className="app-grid pointer-events-none fixed inset-0" />
      <LaunchCopilot />
    </div>
  );
}
