import { NextResponse } from "next/server";
import { dataApiFetch } from "@/lib/backend";

export async function GET() {
  try {
    const res = await dataApiFetch("/api/projects");
    const data = await res.json() as { projects: string[] };
    return NextResponse.json({ projects: data.projects || [] });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ projects: [] }, { status: 500 });
  }
}
