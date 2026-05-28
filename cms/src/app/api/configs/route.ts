import { NextResponse } from "next/server";
import { appConfigSchema } from "@videofy/types";
import { z } from "zod";
import {
  GenerationManifest,
  configOverridePath,
  readJson,
  writeJson,
} from "@/lib/projectFiles";
import { resolveConfigForProject } from "@/lib/configResolver";
import { dataApiFetch } from "@/lib/backend";

type ConfigRow = {
  projectId: string;
  config: unknown;
};

const saveSchema = z.object({
  projectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  config: appConfigSchema,
});

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unexpected error";
}

export async function GET() {
  try {
    const projectsRes = await dataApiFetch("/api/projects");
    const { projects: projectIds } = await projectsRes.json() as { projects: string[] };

    const configs: ConfigRow[] = [];
    for (const projectId of projectIds) {
      try {
        const manifestRes = await dataApiFetch(`/api/projects/${projectId}/manifest`);
        if (!manifestRes.ok) continue;
        const manifest = await manifestRes.json() as GenerationManifest;
        if (!manifest?.projectId) continue;
        const config = await resolveConfigForProject(projectId, manifest);
        configs.push({ projectId, config });
      } catch {
        continue;
      }
    }

    return NextResponse.json(configs);
  } catch (error) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const parsed = saveSchema.parse(await request.json());
    await writeJson(configOverridePath(parsed.projectId), parsed.config);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
