"use client";

import { useEffect, useState } from "react";

type Video = {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  duration: number;
  views: number;
};

export default function WatchPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch("/api/videos");
        if (!response.ok) throw new Error("Failed to fetch videos");
        const data = await response.json();
        setVideos(data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchVideos();
  }, []);

  return (
    <main className="flex justify-center p-8">
      {videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {videos.map((video) => (
            <div
              key={video._id!}
              className="bg-white rounded-lg shadow-md p-4"
              onClick={() => (window.location.href = `/video?id=${video._id}`)} // Navigate to video page
            >
              <h3 className="text-lg font-semibold">{video.title}</h3>
              <p className="text-gray-600">{video.description}</p>
              <img
                src={video.thumbnailPath}
                alt={video.title}
                className="w-full h-auto rounded mt-2"
              />
              <p className="text-sm text-gray-500 mt-1">
                Duration: {video.duration.minutes}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p>Loading videos...</p>
      )}
    </main>
  );
}
