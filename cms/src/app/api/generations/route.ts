import { NextRequest, NextResponse } from "next/server";
import { appConfigSchema, manuscriptSchema } from "@videofy/types";
import { z } from "zod";
import { dataApiFetch } from "@/lib/backend";

const projectIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

const generationTabSchema = z.object({
  articleUrl: z.string().min(1),
  manuscript: manuscriptSchema,
  projectId: projectIdSchema.optional(),
  backendGenerationId: z.string().min(1).optional(),
});

const postBodySchema = z.object({
  projectId: projectIdSchema.optional(),
  data: z.array(generationTabSchema).min(1),
  config: appConfigSchema.optional(),
  brandId: projectIdSchema.optional(),
  project: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
    })
    .optional(),
});

const putBodySchema = z.object({
  id: z.string().min(1),
  data: z.array(generationTabSchema),
});

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unexpected error";
}

function normalizeId(rawId: string): string {
  let decodedId = "";
  try {
    decodedId = decodeURIComponent(rawId);
  } catch {
    throw new Error("Invalid generation id");
  }
  if (!projectIdSchema.safeParse(decodedId).success) {
    throw new Error("Invalid generation id");
  }
  return decodedId;
}

export async function POST(req: NextRequest) {
  try {
    const body = postBodySchema.parse(await req.json());
    const firstTab = body.data[0];
    const fallbackProjectId = firstTab?.projectId || firstTab?.articleUrl;
    const projectId = body.projectId || fallbackProjectId;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const generation = {
      id: projectId,
      projectId,
      data: body.data,
      config: body.config,
      brandId: body.brandId,
      project: body.project || { id: projectId, name: projectId },
      createdDate: now,
      updatedAt: now,
    };

    const res = await dataApiFetch("/api/cms-generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(generation),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json({ id: projectId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const projectId = normalizeId(id);
    const res = await dataApiFetch(`/api/cms-generations?id=${encodeURIComponent(projectId)}`);

    if (res.status === 404) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid generation id") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = putBodySchema.parse(await req.json());
    const projectId = normalizeId(body.id);

    const res = await dataApiFetch(`/api/cms-generations?id=${encodeURIComponent(projectId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: body.data }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid generation id") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
