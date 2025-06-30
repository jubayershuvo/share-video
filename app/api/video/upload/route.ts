// app/api/video/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import formidable, { Fields, Files } from "formidable";
import fs, { mkdirSync, renameSync, existsSync, writeFileSync } from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";

import {
  getVideoStreamsWithLowerDynamic,
  getDefaultAudioBitrate,
  getDefaultBitrate,
  generateMasterPlaylist,
  transcodeToHLS,
  getVideoDuration,
} from "@/lib/videoUtils";
import { VIDEO_OUTPUT_DIR, TEMP_UPLOAD_DIR } from "@/lib/config";
import { connectDB } from "@/db/config";
import Video from "@/db/Video";

// Disable Next.js body parsing (this is default in app router, so no config needed

// Helper: Parse multipart form data using formidable from raw buffer
function parseForm(
  req: NextRequest
): Promise<{ fields: Fields; files: Files }> {
  return new Promise(async (resolve, reject) => {
    const form = formidable({
      uploadDir: TEMP_UPLOAD_DIR,
      keepExtensions: true,
    });

    // Ensure the temp upload directory exists
    if (!existsSync(TEMP_UPLOAD_DIR)) {
      mkdirSync(TEMP_UPLOAD_DIR);
    }

    // Convert the NextRequest into a Node.js-like IncomingMessage stream for formidable
    // We use `form.parse` on a fake req/stream by creating a PassThrough from the body buffer

    // Read the full body buffer
    const buffer = Buffer.from(await req.arrayBuffer());

    // Create a minimal mock request stream
    const { PassThrough } = await import("stream");
    const stream = new PassThrough();
    stream.end(buffer);

    // Add required headers for formidable
    // @ts-ignore
    stream.headers = Object.fromEntries(req.headers.entries());
    // @ts-ignore
    stream.method = req.method || "POST";
    // @ts-ignore
    stream.url = req.url;

    form.parse(stream as any, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

export async function POST(req: NextRequest) {
  await connectDB();
  try {
    const { fields, files } = await parseForm(req);

    // Extract video and thumbnail
    const videoFile = Array.isArray(files.video) ? files.video[0] : files.video;
    const thumbnailFile = Array.isArray(files.thumbnail)
      ? files.thumbnail[0]
      : files.thumbnail;

    // Removed unused metadata reference; duration will be calculated later using getVideoDuration

    if (!videoFile) {
      return NextResponse.json({ error: "No video provided" }, { status: 400 });
    }

    const title = Array.isArray(fields.title)
      ? fields.title[0]
      : fields.title || "";
    const description = Array.isArray(fields.description)
      ? fields.description[0]
      : fields.description || "";

    const videoData = {
      title,
      description,
      uploadDate: new Date(),
      status: "processing",
    };

    const saveVideoData: any = await Video.create(videoData);

    const uploadId = saveVideoData._id.toString();

    const outputBaseDir = path.join(VIDEO_OUTPUT_DIR, uploadId);
    if (!existsSync(outputBaseDir))
      mkdirSync(outputBaseDir, { recursive: true });

    const originalVideoPath = path.join(
      outputBaseDir,
      videoFile.originalFilename || "video"
    );
    renameSync(videoFile.filepath, originalVideoPath);

    let thumbnailUrl: string | null = null;
    if (thumbnailFile) {
      const thumbPath = path.join(
        outputBaseDir,
        thumbnailFile.originalFilename || "thumb.jpg"
      );
      renameSync(thumbnailFile.filepath, thumbPath);
      thumbnailUrl = `/uploads/${uploadId}/${thumbnailFile.originalFilename}`;
    }

    await Video.findByIdAndUpdate(uploadId, {
      thumbnailPath: thumbnailUrl || "",
    });

    // Respond immediately with jobId
    const res = NextResponse.json({
      message: "Upload received. Processing will continue in background.",
      uploadId,
    });

    // Run background processing async, no await here
    (async () => {
      try {
        const formats = await getVideoStreamsWithLowerDynamic(
          originalVideoPath
        );
        console.log("Video formats:", formats);

        const uniqueVariants = formats
          .filter((fmt) => fmt.height >= 144)
          .filter(
            (fmt, i, arr) => arr.findIndex((v) => v.height === fmt.height) === i
          )
          .map((fmt) => ({
            name: `${fmt.height}p`,
            width: fmt.width,
            height: fmt.height,
            videoBitrate: fmt.bitrate
              ? Math.round(fmt.bitrate / 1000) + "k"
              : getDefaultBitrate(fmt.height),
            audioBitrate: getDefaultAudioBitrate(fmt.height),
          }));

        if (uniqueVariants.length === 0) {
          uniqueVariants.push(
            {
              name: "1080p",
              width: 1920,
              height: 1080,
              videoBitrate: "5000k",
              audioBitrate: "192k",
            },
            {
              name: "720p",
              width: 1280,
              height: 720,
              videoBitrate: "2800k",
              audioBitrate: "128k",
            },
            {
              name: "480p",
              width: 854,
              height: 480,
              videoBitrate: "1400k",
              audioBitrate: "128k",
            }
          );
        }

        for (const variant of uniqueVariants) {
          await transcodeToHLS(originalVideoPath, variant, outputBaseDir);
        }

        const master = generateMasterPlaylist(
          uniqueVariants,
          `/uploads/${uploadId}`
        );
        writeFileSync(path.join(outputBaseDir, "master.m3u8"), master);

        if (!thumbnailUrl) {
          await new Promise<void>((resolve, reject) => {
            ffmpeg(originalVideoPath)
              .screenshots({
                timestamps: ["5"],
                filename: "thumbnail.jpg",
                folder: outputBaseDir,
                size: "320x240",
              })
              // @ts-ignore
              .on("end", resolve)
              .on("error", reject);
          });
          thumbnailUrl = `/uploads/${uploadId}/thumbnail.jpg`;
        }

        const durationSec = await getVideoDuration(originalVideoPath);

        await Video.findByIdAndUpdate(uploadId, {
          status: "completed",
          thumbnailPath: thumbnailUrl,
          duration: {
            seconds: Number(durationSec.toFixed(2)), // force back to number
            minutes: Number((durationSec / 60).toFixed(2)),
          },
        });

        const tempVideoPath = videoFile?.filepath;
        const tempThumbnailPath = thumbnailFile?.filepath;

        try {
          if (tempThumbnailPath) {
            await fs.promises.rm(tempThumbnailPath, {
              recursive: true,
              force: true,
            });
          }

          if (tempVideoPath) {
            await fs.promises.rm(tempVideoPath, {
              recursive: true,
              force: true,
            });
          }
        } catch (err) {
          console.error("Failed to delete temp file", err);
        }
      } catch (error) {
        console.error("Processing error:", error);
        await Video.findByIdAndDelete(uploadId);
        try {
          fs.unlinkSync(path.join(VIDEO_OUTPUT_DIR, uploadId));
        } catch (err) {
          console.error("Failed to delete temp file", err);
        }
      }
    })();

    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to parse form or process upload" },
      { status: 500 }
    );
  }
}
