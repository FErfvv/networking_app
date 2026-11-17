import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/auth";
import { backupJson, contactsCsv, interactionsCsv, loadExportData } from "@/lib/data/export";

const KINDS = {
  "contacts.csv": { type: "text/csv; charset=utf-8", build: contactsCsv },
  "interactions.csv": { type: "text/csv; charset=utf-8", build: interactionsCsv },
  "backup.json": { type: "application/json; charset=utf-8", build: (d: Parameters<typeof backupJson>[0]) => backupJson(d) },
} as const;

/** GET /api/export/contacts.csv | interactions.csv | backup.json — the signed-in user's data only (RLS). */
export async function GET(_req: Request, { params }: RouteContext<"/api/export/[kind]">) {
  const { kind } = await params;
  const spec = KINDS[kind as keyof typeof KINDS];
  if (!spec) return NextResponse.json({ error: "Unknown export" }, { status: 404 });

  const ctx = await getAuthedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await loadExportData(ctx);
    const body = spec.build(data);
    const stamp = new Date().toISOString().slice(0, 10);
    const [base, ext] = kind.split(".");
    return new NextResponse(body, {
      headers: {
        "Content-Type": spec.type,
        "Content-Disposition": `attachment; filename="rapport-${base}-${stamp}.${ext}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[export] failed", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
