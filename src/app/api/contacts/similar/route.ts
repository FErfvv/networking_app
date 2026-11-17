import { NextResponse, type NextRequest } from "next/server";
import { getAuthedContext } from "@/lib/auth";
import { findSimilarContacts } from "@/lib/services/contacts";

/**
 * GET /api/contacts/similar?q=jane
 * Duplicate suggestions for Quick Add. A Route Handler (not a Server Action)
 * so lookups run in parallel with — and never delay — a save.
 */
export async function GET(request: NextRequest) {
  const ctx = await getAuthedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const result = await findSimilarContacts(ctx, q);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json(
    { contacts: result.data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
