import { connectDB } from "@/db/config";
import Video from "@/db/Video";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const params = await context.params;
  const id = params.id;
  console.log(id)
  if (!id) {
    return NextResponse.json({ error: "ID not found" }, { status: 404 });
  }
  try {
    const video = await Video.findById(id);
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
    return NextResponse.json(video);
  } catch (error) {
    console.error("Error fetching job status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

