import React, { Suspense } from "react";
import VideoPage from "@/component/VideoPage";


export default function VideoPageWrapper() {
  return (
    <Suspense fallback={<div>Loading video...</div>}>
      <VideoPage />
    </Suspense>
  );
}
