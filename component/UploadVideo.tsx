"use client";

import React, { useState, useRef, useEffect } from "react";
import axios, { AxiosProgressEvent } from "axios";

export default function UploadVideo() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [generatedThumbnailURL, setGeneratedThumbnailURL] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoURL, setVideoURL] = useState<string>("");

  // Processing status & job ID
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<
    "processing" | "done" | "error" | "idle"
  >("idle");
  const [jobId, setJobId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Cleanup URLs on unmount or file change
  useEffect(() => {
    return () => {
      if (videoURL) URL.revokeObjectURL(videoURL);
      if (generatedThumbnailURL) URL.revokeObjectURL(generatedThumbnailURL);
    };
  }, [videoURL, generatedThumbnailURL]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoURL(url);
      generateThumbnail(file);
    }
  };

  const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoURL(url);
      generateThumbnail(file);
    }
  };

  const handleThumbnail = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setThumbnail(file);
      setGeneratedThumbnailURL(URL.createObjectURL(file));
    }
  };

  const generateThumbnail = (file: File) => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);

    // Clean up object URL when video element is unloaded
    const revokeVideoURL = () => URL.revokeObjectURL(video.src);
    video.addEventListener("error", revokeVideoURL);
    video.addEventListener("abort", revokeVideoURL);

    video.addEventListener("loadeddata", () => {
      // Seek to 1 second (or as close as possible)
      if (video.duration < 1) {
        video.currentTime = 0;
      } else {
        video.currentTime = 1;
      }
    });

    video.addEventListener("seeked", () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              setGeneratedThumbnailURL(url);
              setThumbnail(new File([blob], "thumbnail.jpg", { type: "image/jpeg" }));
            }
          },
          "image/jpeg",
          0.75
        );
      }
      revokeVideoURL();

      // Cleanup event listeners after use
      video.removeEventListener("loadeddata", () => {});
      video.removeEventListener("seeked", () => {});
      video.removeEventListener("error", revokeVideoURL);
      video.removeEventListener("abort", revokeVideoURL);
    });
  };

  // Poll job status every 3 seconds until done/error
  const checkJobStatus = async (id: string) => {
    try {

      const res = await axios.get(`/api/video/status/${id}`);
      const status = res.data.status;

      if (status === "processing") {
        setProcessingStatus("processing");
        setTimeout(() => checkJobStatus(id), 3000);
      } else if (status === "done") {
        setProcessingStatus("done");
        setProcessing(false);
      } else {
        setProcessingStatus("error");
        setProcessing(false);
      }
    } catch (err) {
      console.error(err);
      setProcessingStatus("error");
      setProcessing(false);
    }
  };

  const handleUpload = async () => {
    if (!videoFile) return;

    setUploadProgress(0);
    setProcessingStatus("idle");
    setProcessing(false);

    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("title", title);
    formData.append("description", description);
    if (thumbnail) formData.append("thumbnail", thumbnail);

    try {
      setProcessing(true);

      const res = await axios.post("/api/video/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });

      console.log("Upload complete:", res.data);
      const newJobId = res.data.uploadId;
      setJobId(newJobId);

      setProcessingStatus("processing");
      checkJobStatus(newJobId);
    } catch (err) {
      console.error(err);
      setProcessingStatus("error");
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h2 className="text-xl font-bold">Upload Your Video</h2>

      {/* Drag & Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`relative border-2 border-dashed border-gray-400 rounded-md p-8 text-center transition-all duration-300 ${
          videoFile ? "border-green-500" : "hover:border-blue-500"
        }`}
      >
        {videoFile ? (
          <p>{videoFile.name}</p>
        ) : (
          <p>Drag & drop your video here or click to browse</p>
        )}
        <input
          type="file"
          accept="video/*"
          onChange={handleBrowse}
          className="absolute opacity-0 inset-0 cursor-pointer"
        />
      </div>

      {/* Video Preview */}
      {videoURL && (
        <div className="w-full overflow-hidden rounded-md border border-gray-300">
          <video src={videoURL} controls className="w-full h-auto rounded" ref={videoRef} />
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block mb-1 font-medium">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="Enter video title"
          disabled={processing}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block mb-1 font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="Add a description..."
          rows={4}
          disabled={processing}
        />
      </div>

      {/* Generated Thumbnail Preview */}
      {generatedThumbnailURL && (
        <div>
          <label className="block mb-1 font-medium">Generated Thumbnail</label>
          <img
            src={generatedThumbnailURL}
            alt="Generated Thumbnail"
            className="w-48 rounded shadow-md"
          />
        </div>
      )}

      {/* Custom Thumbnail Upload */}
      <div>
        <label className="block mb-1 font-medium">Replace Thumbnail</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleThumbnail}
          className="block"
          disabled={processing}
        />
      </div>

      {/* Progress Bar */}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="relative w-full bg-gray-300 rounded h-2">
          <div
            className="absolute top-0 left-0 h-2 bg-blue-500 rounded transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
          <span className="absolute right-0 -top-6 text-sm text-black">{uploadProgress}%</span>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!videoFile || processing}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {processing ? "Processing..." : "Upload Video"}
      </button>

      {/* Processing Modal */}
      {processing && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center text-white z-50 p-4 text-center">
          <div className="text-xl mb-4">Processing video, please wait...</div>
          {processingStatus === "done" && (
            <div className="text-green-500 font-semibold">Processing complete!</div>
          )}
          {processingStatus === "error" && (
            <div className="text-red-500 font-semibold">An error occurred during processing.</div>
          )}
        </div>
      )}
    </div>
  );
}
