import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";

export type Variant = {
  name: string;
  width: number;
  height: number;
  videoBitrate: string;
  audioBitrate: string;
};

// Default video bitrate based on height
export function getDefaultBitrate(height: number): string {
  if (height >= 1080) return "5000k";
  if (height >= 720) return "2800k";
  if (height >= 480) return "1400k";
  if (height >= 360) return "800k";
  return "400k";
}

// Default audio bitrate based on height
export function getDefaultAudioBitrate(height: number): string {
  if (height >= 720) return "192k";
  if (height >= 480) return "128k";
  return "96k";
}

type VideoStream = {
  codec_type: string;
  height: number;
  width: number;
  bit_rate?: string;
};

// Analyze video streams and return available formats (resolutions)
export function getVideoStreamsWithLowerDynamic(
  videoPath: string
): Promise<Array<{ height: number; width: number; bitrate: number | null }>> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);

      const videoStreams = (metadata.streams as VideoStream[]).filter(
        (s) => s.codec_type === "video"
      );
      if (!videoStreams.length) return resolve([]);

      const maxHeight = videoStreams.reduce(
        (max, stream) => (stream.height > max ? stream.height : max),
        0
      );
      const minHeight = 144;

      const commonHeights = [
        15360, 7680, 4320, 2160, 1440,
        1080, 720, 480, 360, 240, 144,
      ];

      // Filter heights supported by the video and above minHeight
      const targetResolutions = commonHeights.filter(
        (h) => h <= maxHeight && h >= minHeight
      );

      // Include maxHeight if non-standard resolution and >= minHeight
      if (!targetResolutions.includes(maxHeight) && maxHeight >= minHeight) {
        targetResolutions.unshift(maxHeight);
      }

      const formats = targetResolutions.map((height) => ({
        height,
        width: Math.round((16 / 9) * height), // Assuming 16:9 aspect ratio
        bitrate: null,
      }));

      resolve(formats);
    });
  });
}

// Generate master HLS playlist content
export function generateMasterPlaylist(
  variants: Variant[],
  baseUrl: string
): string {
  let playlist = "#EXTM3U\n#EXT-X-VERSION:3\n";
  variants.forEach((variant) => {
    const totalBandwidth =
      parseInt(variant.videoBitrate) * 1000 + parseInt(variant.audioBitrate) * 1000;
    playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${totalBandwidth},RESOLUTION=${variant.width}x${variant.height}\n`;
    playlist += `${variant.name}/index.m3u8\n`;
  });
  return playlist;
}

// Transcode one variant to HLS
export function transcodeToHLS(
  inputPath: string,
  variant: Variant,
  outputDir: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const variantDir = path.join(outputDir, variant.name);
    if (!fs.existsSync(variantDir)) {
      fs.mkdirSync(variantDir, { recursive: true });
    }

    ffmpeg(inputPath)
      .videoCodec("libx264")
      .size(`${variant.width}x${variant.height}`)
      .videoBitrate(variant.videoBitrate)
      .audioCodec("aac")
      .audioBitrate(variant.audioBitrate)
      .outputOptions([
        "-hls_time 6",
        "-hls_playlist_type vod",
        "-hls_segment_filename",
        path.join(variantDir, "segment%d.ts"),
      ])
      .output(path.join(variantDir, "index.m3u8"))
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

export const getVideoDuration = (filePath: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      if (!metadata.format || !metadata.format.duration) return reject(new Error("No duration found"));
      resolve(metadata.format.duration);
    });
  });
};
