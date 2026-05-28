import { NextResponse } from "next/server";
import { z } from "zod";
import { listFetchers } from "@/lib/fetchers";
import { dataApiFetch } from "@/lib/backend";

const runSchema = z.object({
  fetcherId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  inputs: z.record(z.string(), z.string()).default({}),
});

export async function GET() {
  try {
    const fetchers = await listFetchers();
    return NextResponse.json({ fetchers });
  } catch (error) {
    console.error("Failed to list fetchers:", error);
    return NextResponse.json({ fetchers: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = runSchema.parse(await request.json());
    const url = body.inputs?.url || "";
    const res = await dataApiFetch("/api/import/web", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, brand_id: "2secure" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = (data as { detail?: string }).detail || "Import misslyckades";
      return NextResponse.json({ error: message }, { status: res.status });
    }
    const data = await res.json() as { project_id: string; stdout: string; stderr: string };
    return NextResponse.json({
      projectId: data.project_id,
      stdout: data.stdout,
      stderr: data.stderr,
      command: [],
    });
  } catch (error) {
    console.error("Failed to run fetcher:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run fetcher" },
      { status: 400 }
    );
  }
}
