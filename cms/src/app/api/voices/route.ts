import { NextResponse } from "next/server";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { configRoot, generationManifestPath, readJson } from "@/lib/projectFiles";

type VoiceOption = { id: string; name: string };

async function readBrandVoices(brandId: string): Promise<VoiceOption[]> {
  const brandsDir = configRoot();
  let brandPath = join(brandsDir, `${brandId}.json`);

  try {
    const brand = await readJson<Record<string, unknown>>(brandPath, {});
    if (Object.keys(brand).length === 0) {
      const entries = await readdir(brandsDir, { withFileTypes: true });
      const jsonFiles = entries
        .filter((e) => e.isFile() && e.name.endsWith(".json"))
        .map((e) => e.name)
        .sort();
      const fallback =
        jsonFiles.find((f) => f === "default.json") || jsonFiles[0];
      if (!fallback) return [];
      brandPath = join(brandsDir, fallback);
      const fallbackBrand = await readJson<Record<string, unknown>>(brandPath, {});
      return extractVoices(fallbackBrand);
    }
    return extractVoices(brand);
  } catch {
    return [];
  }
}

function extractVoices(brand: Record<string, unknown>): VoiceOption[] {
  const voices = brand.voices;
  if (!Array.isArray(voices)) return [];
  return voices.filter(
    (v): v is VoiceOption =>
      typeof v === "object" &&
      v !== null &&
      typeof (v as Record<string, unknown>).id === "string" &&
      typeof (v as Record<string, unknown>).name === "string"
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const manifest = await readJson<{ brandId?: string }>(
      generationManifestPath(projectId),
      {}
    );
    const brandId = manifest.brandId || "default";
    const voices = await readBrandVoices(brandId);

    return NextResponse.json({ voices });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
