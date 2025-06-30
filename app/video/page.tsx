"use client";

import VideoPlayer from "@/component/VideoPlayer";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function VideoPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");


  if (!id) {
    return (
      <main className="p-8">
        <p>Video not found</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <VideoPlayer
        id={id}
        autoPlay={true}
        width={800}
      />
    </main>
  );
}
