import { NextResponse } from "next/server";
import { playerSchema, processedManuscriptSchema } from "@videofy/types";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  projectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  orientation: z.enum(["vertical", "horizontal", "square"]).default("vertical"),
  manuscripts: z.array(processedManuscriptSchema).min(1),
  playerConfig: playerSchema,
  voice: z.boolean().default(true),
  backgroundMusic: z.boolean().default(true),
  disabledLogo: z.boolean().default(false),
});

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unexpected error";
}

export async function POST(request: Request) {
  try {
    bodySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 });
  }

  // Remotion rendering requires a local environment with Chromium and a persistent filesystem.
  // On cloud deployments, trigger rendering via the local API server instead.
  return NextResponse.json(
    { error: "Video rendering is not available in this deployment. Run the CMS locally to render videos." },
    { status: 503 }
  );
}
