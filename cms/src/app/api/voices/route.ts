import { NextResponse } from "next/server";
import { dataApiFetch } from "@/lib/backend";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    let brandId = "2secure";
    try {
      const manifestRes = await dataApiFetch(`/api/projects/${projectId}/manifest`);
      if (manifestRes.ok) {
        const manifest = await manifestRes.json() as { brandId?: string };
        brandId = manifest.brandId || "2secure";
      }
    } catch {
      // fall back to default brand
    }

    const voicesRes = await dataApiFetch(`/api/brands/${brandId}/voices`);
    if (!voicesRes.ok) {
      return NextResponse.json({ voices: [] });
    }
    return NextResponse.json(await voicesRes.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
