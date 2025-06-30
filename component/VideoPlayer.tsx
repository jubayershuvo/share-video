"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";

type Props = {
  id: string;
  autoPlay?: boolean;
  width?: number;
  onVideoPlaying?: () => void;
};

export default function VideoPlayer({
  id,
  autoPlay = false,
  width = 640,
  onVideoPlaying,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Playback states
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState<number>(autoPlay ? 0 : 1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const poster = `/uploads/${id}/thumbnail.jpg`; // Placeholder poster image
  const src = `/uploads/${id}/master.m3u8`; // Replace with actual video source URL
  const [time, setTime] = useState(0);

  useEffect(() => {
    const savedTime = localStorage.getItem(`time-${id}`);
    if (savedTime) {
      setTime(parseFloat(savedTime));
    }
  }, [id]);
  // Quality levels from HLS
  const [levels, setLevels] = useState<any[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);

  // Playback quality
  const [quality, setQuality] = useState("");

  // Playback speed (normal = 1)
  const [playbackRate, setPlaybackRate] = useState(1);

  // Skip state for showing the skip circle
  const [skipState, setSkipState] = useState<{
    direction: "forward" | "backward" | null;
    amount: number;
  }>({ direction: null, amount: 0 });
  const skipTimeout = useRef<NodeJS.Timeout | null>(null);

  // Controls hide timer
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // === Initialize HLS and load video ===
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);

    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLevels(hls.levels);
        setIsLoading(false);
        // Try autoplay with muted fallback
        if (autoPlay) {
          video.muted = true;
          video.play().catch(() => {});
          video.muted = false; // Fallback for browsers that require user interaction
          setIsMuted(false);
          setVolume(1);
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setQuality(`${hls.levels[data.level].height}p`);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setIsLoading(false);
        }
      });

      return () => hls.destroy();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.onloadedmetadata = () => setIsLoading(false);
      if (autoPlay) {
        video.muted = true;
        video.play().catch(() => {});
        video.muted = false; // Fallback for browsers that require user interaction
        setIsMuted(false);
        setVolume(1);
      }
    }
  }, [src, autoPlay]);

  // === Video event listeners ===
  const lastSavedTime = useRef(0);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.currentTime - lastSavedTime.current > 2) {
        localStorage.setItem(`time-${id}`, String(video.currentTime));
        lastSavedTime.current = video.currentTime;
      }
    };

    const onLoadedMetadata = () => {
      setDuration(video.duration);
      if (time && time > 0) {
        video.currentTime = time; // Seek video to start time
      }
      setCurrentTime(video.currentTime);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => setIsLoading(false);
    const onEnded = () => setIsPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  // === Buffered time update ===
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateBuffered = () => {
      if (!video.buffered || !duration) return;

      for (let i = 0; i < video.buffered.length; i++) {
        if (
          video.currentTime >= video.buffered.start(i) &&
          video.currentTime <= video.buffered.end(i)
        ) {
          setBufferedTime(video.buffered.end(i));
          return;
        }
      }
      setBufferedTime(
        video.buffered.length
          ? video.buffered.end(video.buffered.length - 1)
          : 0
      );
    };

    video.addEventListener("progress", updateBuffered);
    video.addEventListener("timeupdate", updateBuffered);

    // initial update
    updateBuffered();

    return () => {
      video.removeEventListener("progress", updateBuffered);
      video.removeEventListener("timeupdate", updateBuffered);
    };
  }, [duration]);

  // === Playback controls ===
  const togglePlay = () => {
    resetHideControls();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const toggleMute = () => {
    resetHideControls();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    if (!video.muted) setVolume(0.5);
    else setVolume(0);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    resetHideControls();
    const vol = parseFloat(e.target.value);
    const video = videoRef.current;
    if (!video) return;
    video.volume = vol;
    setVolume(vol);
    video.muted = vol === 0;
    setIsMuted(vol === 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    resetHideControls();
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = parseFloat(e.target.value);
    setCurrentTime(video.currentTime);
  };

  const handleQualityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    resetHideControls();
    const idx = Number(e.target.value);

    if (hlsRef.current) {
      // 👇 Force buffer flush: Set `nextLevel` instead of `currentLevel`
      hlsRef.current.nextLevel = idx;

      // Optional: flush buffer manually (more aggressive)
      hlsRef.current.stopLoad();
      hlsRef.current.startLoad();

      setCurrentLevel(idx);
    }
  };

  const toggleFullscreen = () => {
    resetHideControls();
    const container = videoRef.current?.parentElement;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // === Auto-hide controls ===
  const resetHideControls = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    if (optionsOpen) {
      setShowControls(true);
      return;
    }
    hideControlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  useEffect(() => {
    const container = videoRef.current?.parentElement;
    if (!container) return;

    const onMouseMove = () => resetHideControls();
    container.addEventListener("mousemove", onMouseMove);
    resetHideControls();

    return () => {
      container.removeEventListener("mousemove", onMouseMove);
      if (hideControlsTimeout.current)
        clearTimeout(hideControlsTimeout.current);
    };
  }, [resetHideControls]);

  // === Skip logic (on tap/click with multiple clicks) ===
  const handleSkip = (direction: "backward" | "forward", clicks: number) => {
    if (clicks < 2) return; // skip only if 2 or more taps
    const video = videoRef.current;
    if (!video) return;

    const extraSec = (clicks - 1) * 10;
    const totalSkip =
      skipState.direction === direction
        ? skipState.amount + extraSec
        : extraSec;

    if (direction === "forward") {
      video.currentTime = Math.min(video.currentTime + extraSec, duration);
    } else {
      video.currentTime = Math.max(video.currentTime - extraSec, 0);
    }

    setSkipState({ direction, amount: totalSkip });

    if (skipTimeout.current) clearTimeout(skipTimeout.current);
    skipTimeout.current = setTimeout(() => {
      setSkipState({ direction: null, amount: 0 });
    }, 800);
  };

  // === Keyboard shortcuts ===
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if (e.code === "KeyM") toggleMute();
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "ArrowRight") handleSkip("forward", 2);
      if (e.code === "ArrowLeft") handleSkip("backward", 2);
      if (e.code === "KeyL") {
        // reset playback rate to normal
        setPlaybackRate(1);
        if (videoRef.current) videoRef.current.playbackRate = 1;
      }
      if (e.code === "BracketRight") {
        // increase speed
        setPlaybackRate((rate) => {
          const newRate = Math.min(rate + 0.25, 3);
          if (videoRef.current) videoRef.current.playbackRate = newRate;
          return newRate;
        });
      }
      if (e.code === "BracketLeft") {
        // decrease speed
        setPlaybackRate((rate) => {
          const newRate = Math.max(rate - 0.25, 0.25);
          if (videoRef.current) videoRef.current.playbackRate = newRate;
          return newRate;
        });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [skipState]);

  // Update playback rate when changed by UI
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  return (
    <div
      className={`relative w-full h-full bg-black select-none`}
      onMouseLeave={() => {
        setShowControls(false);
      }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        poster={poster}
        autoPlay={autoPlay}
        muted={isMuted}
        // volume={volume}
        className={`w-full h-full`}
        playsInline
      />

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20 pointer-events-none">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Transparent overlay */}
      {showControls === false && (
        <div
          className={`absolute inset-0 bg-transparent z-99 ${
            showControls ? "cursor-default" : "cursor-none"
          }`}
          onClick={() => setShowControls(true)}
        />
      )}

      {/* Controls */}
      {showControls ? (
        <div className="">
          {/* Left skip area */}
          <div
            className="absolute inset-y-0 left-0 w-1/3 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleSkip("backward", e.detail);
            }}
          />

          {/* Middle play/pause area */}
          <div
            className="absolute inset-y-0 left-1/3 w-1/3 flex items-center justify-center cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
          />
          {/* Right skip area */}
          <div
            className="absolute inset-y-0 right-0 w-1/3 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleSkip("forward", e.detail);
            }}
          />

          {/* Skip feedback circle */}
          {skipState.direction && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div
                className="w-24 h-24 rounded-full border-4 border-white flex items-center justify-center text-3xl font-bold animate-ping"
                style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
              >
                {skipState.direction === "forward"
                  ? `+${skipState.amount}s`
                  : `-${skipState.amount}s`}
              </div>
            </div>
          )}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 flex flex-col gap-2 text-white z-50"
          >
            {/* Seek bar */}
            <div className="relative w-full h-6">
              {" "}
              {/* Make container a bit taller */}
              {/* Base bar: not loaded (gray) */}
              <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-600 transform -translate-y-1/2 rounded" />
              {/* Buffered: white */}
              <div
                className="absolute top-1/2 left-0 h-1 bg-white transform -translate-y-1/2 rounded"
                style={{
                  width: duration
                    ? `${(bufferedTime / duration) * 100}%`
                    : "0%",
                }}
              />
              {/* Played: blue */}
              <div
                className="absolute top-1/2 left-0 h-1 bg-blue-500 transform -translate-y-1/2 rounded"
                style={{
                  width: duration ? `${(currentTime / duration) * 100}%` : "0%",
                }}
              />
              {/* Slider on top */}
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                step={0.1}
                onChange={handleSeek}
                className="w-full h-6 bg-transparent cursor-pointer relative z-10 appearance-none"
              />
              <style jsx>{`
                input[type="range"] {
                  -webkit-appearance: none;
                  width: 100%;
                  height: 24px; /* Makes clickable area bigger */
                  background: transparent;
                  cursor: pointer;
                }
                input[type="range"]::-webkit-slider-runnable-track {
                  height: 4px; /* matches the bar thickness */
                  background: transparent;
                }
                input[type="range"]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  height: 16px;
                  width: 16px;
                  border-radius: 50%;
                  background: white;
                  margin-top: -6px; /* 👈 centers the thumb: half thumb minus half track */
                  cursor: pointer;
                }
                input[type="range"]::-moz-range-track {
                  height: 4px;
                  background: transparent;
                }
                input[type="range"]::-moz-range-thumb {
                  height: 16px;
                  width: 16px;
                  border-radius: 50%;
                  background: white;
                  cursor: pointer;
                  border: none;
                }
              `}</style>
            </div>

            {/* Bottom controls row */}
            <div className="flex justify-between items-center gap-2 text-sm flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  // onClick={handlePrev}
                  aria-label="Previous"
                  className="w-8 h-8 text-white cursor-pointer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-6 h-6"
                  >
                    {/* Double triangles pointing left */}
                    <polygon points="18,5 10,12 18,19" />
                    <rect x="6" y="5" width="2" height="14" />
                  </svg>
                </button>
                <button
                  onClick={togglePlay}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="w-8 h-8 text-white cursor-pointer"
                >
                  {isPlaying ? (
                    // Pause icon: two vertical bars like ❚❚
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-6 h-6"
                    >
                      <rect x="6" y="5" width="4" height="14" />
                      <rect x="14" y="5" width="4" height="14" />
                    </svg>
                  ) : (
                    // Play icon: right-pointing triangle ▶
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-6 h-6"
                    >
                      <polygon points="8,5 19,12 8,19" />
                    </svg>
                  )}
                </button>
                <button
                  // onClick={handleNext}
                  aria-label="Next"
                  className="w-8 h-8 text-white cursor-pointer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-6 h-6"
                  >
                    {/* Double triangles pointing right */}
                    <polygon points="6,5 14,12 6,19" />
                    <rect x="16" y="5" width="2" height="14" />
                  </svg>
                </button>
                <div className="relative inline-flex items-center gap-2 group">
                  <button
                    onClick={toggleMute}
                    aria-label={isMuted ? "Unmute" : "Mute"}
                    className="w-6 h-6 text-white transition-all duration-300 cursor-pointer"
                  >
                    {isMuted ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        stroke="none"
                      >
                        {/* Speaker shape */}
                        <path d="M3 9v6h4l5 5V4L7 9H3z" />
                        {/* Slash */}
                        <line
                          x1="2"
                          y1="2"
                          x2="22"
                          y2="22"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        stroke="none"
                      >
                        {/* Speaker shape */}
                        <path d="M3 9v6h4l5 5V4L7 9H3z" />

                        {/* Smallest wave */}
                        <path
                          d="M15.5 10a2.5 2.5 0 0 1 0 4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />

                        {/* Medium wave */}
                        <path
                          d="M17.5 8a4.5 4.5 0 0 1 0 8"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />

                        {/* Largest wave */}
                        <path
                          d="M19.5 6a6.5 6.5 0 0 1 0 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                  </button>

                  {/* Volume slider: hidden by default, show on hover */}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={handleVolume}
                    className="h-1 cursor-pointer opacity-0 w-0 group-hover:opacity-100 group-hover:w-12 transition-all duration-300 ease-in-out"
                  />
                </div>
                <span className="min-w-[80px] tabular-nums">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                •
                <span className="min-w-[50px] tabular-nums">
                  {quality || "Auto"}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Playback speed select */}
                <label className="relative inline-block">
                  <select
                    value={playbackRate}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setPlaybackRate(val);
                      resetHideControls();
                    }}
                    className="
        appearance-none
        bg-black/70
        text-white
        px-3 py-1
        pr-8
        rounded-md
        cursor-pointer
        border border-gray-500
        hover:bg-black/90
        focus:outline-none focus:ring-2 focus:ring-blue-500
        transition
      "
                  >
                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3].map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}x
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-white">
                    <svg
                      className="w-4 h-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </span>
                </label>

                {/* Quality select */}
                {levels.length > 0 && (
                  <label className="relative inline-block">
                    <select
                      value={currentLevel}
                      onChange={handleQualityChange}
                      title="Quality"
                      className="
          appearance-none
          bg-black/70
          text-white
          px-3 py-1
          pr-8
          rounded-md
          cursor-pointer
          border border-gray-500
          hover:bg-black/90
          focus:outline-none focus:ring-2 focus:ring-blue-500
          transition
        "
                    >
                      <option value={-1}>Auto</option>
                      {levels.map((level, i) => (
                        <option key={i} value={i}>
                          {level.height}p
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-white">
                      <svg
                        className="w-4 h-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </span>
                  </label>
                )}

                {/* Fullscreen button */}
                <button
                  onClick={() => {
                    toggleFullscreen();
                    resetHideControls();
                  }}
                  aria-label={
                    isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                  }
                  className="w-6 h-6 text-white"
                  onMouseEnter={resetHideControls}
                  onMouseLeave={resetHideControls}
                >
                  {isFullscreen ? (
                    // Exit fullscreen icon
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                      className="w-6 h-6"
                    >
                      <path d="M9 9L5 5m0 0h4m-4 0v4m6 6l4 4m0 0h-4m4 0v-4" />
                    </svg>
                  ) : (
                    // Enter fullscreen icon
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                      className="w-6 h-6"
                    >
                      <path d="M4 4h6M4 4v6M20 20h-6M20 20v-6M14 10l6-6M10 14l-6 6" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`absolute left-0 h-0.5 right-0 bg-gray-600 z-40 ${
            isFullscreen ? "bottom-0.5" : "bottom-0"
          }`}
        >
          {/* Buffered progress */}
          <div
            className="h-full bg-gray-400"
            style={{
              width: duration ? `${(bufferedTime / duration) * 100}%` : "0%",
            }}
          />
          {/* Played progress */}
          <div
            className="absolute top-0 left-0 h-full bg-blue-600"
            style={{
              width: duration ? `${(currentTime / duration) * 100}%` : "0%",
            }}
          />
        </div>
      )}
    </div>
  );
}
