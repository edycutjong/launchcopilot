// Records one real pipeline run to data/demo-kit.json by hitting the running
// dev server's /api/kit SSE endpoint. Run the server with DEMO_MODE=0 first.
import fs from "node:fs";

const listing = JSON.parse(fs.readFileSync("data/fixtures/pocketplants.json", "utf8"));
const res = await fetch("http://localhost:3000/api/kit", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(listing),
});
if (!res.ok) {
  console.error("HTTP", res.status, await res.text());
  process.exit(1);
}

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = "";
let kit = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  const frames = buf.split("\n\n");
  buf = frames.pop() ?? "";
  for (const f of frames) {
    const line = f.split("\n").find((l) => l.startsWith("data: "));
    if (!line) continue;
    const evt = JSON.parse(line.slice(6));
    if (evt.type === "stage") console.log(`  ${evt.status === "start" ? "▶" : "✓"} ${evt.stage}${evt.detail ? " — " + evt.detail : ""}`);
    else if (evt.type === "aso_repair") console.log(`      aso ${evt.approach} attempt ${evt.attempt}: ${evt.score}/100`);
    else if (evt.type === "panel") console.log(`      panel ${evt.artifactId}: ${evt.mean}`);
    else if (evt.type === "error") { console.error("PIPELINE ERROR:", evt.message); process.exit(1); }
    else if (evt.type === "done") kit = evt.kit;
  }
}

if (!kit) { console.error("no kit produced"); process.exit(1); }
fs.writeFileSync("data/demo-kit.json", JSON.stringify(kit, null, 2));
console.log(`\n  ✅ recorded data/demo-kit.json`);
console.log(`     before ${kit.lintBefore.score}/${kit.lintBefore.grade} → variants ${kit.aso.variants.map((v) => v.lintAfter.score + "/" + v.lintAfter.grade).join(", ")}`);
console.log(`     coverage ${kit.coverageBefore}% → ${kit.aso.variants.map((v) => v.coverageAfter + "%").join(", ")}`);
console.log(`     communities: ${kit.communities.map((c) => c.name + (c.bestDay ? " (" + c.bestDay + ")" : "")).join(", ")}`);
console.log(`     aso pick: ${kit.aso.pick.approach} — ${kit.aso.pick.reason}`);
