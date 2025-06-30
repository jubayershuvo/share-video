import { connectDB } from "@/db/config";
import Video from "@/db/Video";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  await connectDB();

  try {
    const videos = await Video.find({status:"completed"}).lean();
    if (!videos) {
      return NextResponse.json({ error: "Videos not found" }, { status: 404 });
    }
    return NextResponse.json(videos);
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

