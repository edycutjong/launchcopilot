import { NextRequest, NextResponse } from "next/server";
import { lint } from "@/lib/aso-lint";
import { AppListingSchema } from "@/lib/schemas/listing";

export const runtime = "nodejs";

/**
 * Free public endpoint: grade a store listing against the 28-rule ASO lint
 * engine. No key, no signup — the lint engine as an API.
 *
 *   curl -X POST https://<host>/api/analyze \
 *     -H 'content-type: application/json' \
 *     -d @data/fixtures/pocketplants.json
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = AppListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid listing", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  return NextResponse.json(lint(parsed.data));
}
