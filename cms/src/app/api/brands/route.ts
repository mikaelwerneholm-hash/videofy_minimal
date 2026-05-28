import { NextResponse } from "next/server";
import { dataApiFetch } from "@/lib/backend";

export async function GET() {
  try {
    const res = await dataApiFetch("/api/brands");
    if (!res.ok) {
      return NextResponse.json({ brands: [] }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (error) {
    console.error("Failed to list brands:", error);
    return NextResponse.json({ brands: [] }, { status: 500 });
  }
}
