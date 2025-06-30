import path from "path";

// In Next.js, __dirname may point to `.next` build folder.
// Use `process.cwd()` to reliably resolve from project root.
export const VIDEO_OUTPUT_DIR = path.join(process.cwd(), "public/uploads");
export const TEMP_UPLOAD_DIR = path.join(process.cwd(), "temp_uploads");
