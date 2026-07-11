import { NextRequest, NextResponse } from "next/server";
import { AppListingSchema } from "@/lib/schemas/listing";
import { KitEvent, runPipeline } from "@/lib/pipeline";
import { isDemoMode, replayDemo } from "@/lib/pipeline/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 60s is the Vercel hobby/fluid ceiling; the demo replay finishes in ~8s. Raise
// to 300 on Pro if running the live pipeline (which takes minutes).
export const maxDuration = 60;

// Tiny in-memory rate limit (resets on redeploy — documented limitation).
const hits = new Map<string, { n: number; day: string }>();
const LIMIT = Number(process.env.FREE_KITS_PER_DAY ?? 3);

function rateLimited(ip: string): boolean {
  if (isDemoMode()) return false;
  const day = new Date().toISOString().slice(0, 10);
  const rec = hits.get(ip);
  if (!rec || rec.day !== day) {
    hits.set(ip, { n: 1, day });
    return false;
  }
  rec.n++;
  return rec.n > LIMIT;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = AppListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid listing", issues: parsed.error.issues }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: `Free tier is ${LIMIT} kits/day. Try again tomorrow or upgrade.` },
      { status: 429 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: KitEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        if (isDemoMode()) await replayDemo(send);
        else await runPipeline(parsed.data, send);
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Pipeline failed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
