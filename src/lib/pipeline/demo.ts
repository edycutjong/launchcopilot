import demoKitJson from "../../../data/demo-kit.json";
import type { Kit, KitEvent } from "./index";

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "1" || !process.env.ANTHROPIC_API_KEY;
}

// Static import so Vercel's serverless file-tracing bundles the recorded kit
// (a runtime fs read of a computed path would not be traced).
export function loadDemoKit(): Kit | null {
  return { ...(demoKitJson as unknown as Kit), demoMode: true };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Replay a recorded kit as a believable live stream — no API key needed. */
export async function replayDemo(send: (e: KitEvent) => void): Promise<void> {
  const kit = loadDemoKit();
  if (!kit) {
    send({ type: "error", message: "Demo kit not recorded yet." });
    return;
  }

  send({ type: "stage", stage: "profile", status: "start" });
  await sleep(500);
  send({ type: "stage", stage: "profile", status: "done", detail: `${kit.profile.personas.length} personas` });

  send({ type: "stage", stage: "aso", status: "start" });
  for (const v of kit.aso.variants) {
    // walk the score up across the recorded repair attempts
    for (let a = 0; a <= v.repairAttempts; a++) {
      await sleep(420);
      const score = a === v.repairAttempts ? v.lintAfter.score : Math.min(88, kit.lintBefore.score + a * 30);
      send({ type: "aso_repair", approach: v.approach, attempt: a, score });
    }
  }
  send({ type: "stage", stage: "aso", status: "done", detail: `A/B ${kit.aso.variants.map((v) => v.lintAfter.score).join(" & ")}` });

  for (const stage of ["producthunt", "social", "community", "press"]) {
    send({ type: "stage", stage, status: "start" });
    await sleep(650);
    send({ type: "stage", stage, status: "done" });
  }

  send({ type: "stage", stage: "panel", status: "start" });
  for (const v of kit.panel.verdicts) {
    await sleep(300);
    const scores = v.personaReactions.flatMap((r) => [r.specificity, r.hookStrength, r.channelFit]);
    const mean = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
    send({ type: "panel", artifactId: v.artifactId, mean: Math.round(mean * 10) / 10 });
  }
  send({ type: "stage", stage: "panel", status: "done" });

  send({ type: "done", kit });
}
