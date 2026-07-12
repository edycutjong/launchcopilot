import { NextRequest, NextResponse } from "next/server";
import { extractListing, ExtractError } from "@/lib/extract";

export const runtime = "nodejs";

/**
 * Paste an App Store / Google Play link → get back a partial {@link AppListing}
 * to auto-fill the grader form, plus any fields we couldn't read.
 *
 *   curl -X POST https://<host>/api/extract \
 *     -H 'content-type: application/json' \
 *     -d '{"url":"https://apps.apple.com/us/app/id1502936453"}'
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const url = typeof (body as { url?: unknown })?.url === "string" ? (body as { url: string }).url : "";
  if (!url.trim()) {
    return NextResponse.json({ error: "Paste an App Store or Google Play link." }, { status: 400 });
  }

  try {
    return NextResponse.json(await extractListing(url));
  } catch (e) {
    if (e instanceof ExtractError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("extract error:", e);
    return NextResponse.json({ error: "Couldn’t reach that store listing. Check the link and try again." }, { status: 502 });
  }
}
