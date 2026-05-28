import { NextResponse } from "next/server";
import { z } from "zod";
import { dataApiFetch } from "@/lib/backend";

const paramsSchema = z.object({
  projectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
});

const patchSchema = z.object({
  brandId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const params = paramsSchema.parse(await context.params);
    const body = patchSchema.parse(await request.json());

    const res = await dataApiFetch(`/api/projects/${params.projectId}/manifest`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId: body.brandId }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to update project manifest:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update project manifest" }, { status: 400 });
  }
}
