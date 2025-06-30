import mongoose, { Schema, Document, Model } from "mongoose";

export interface IVideo extends Document {
  title: string;
  description?: string;
  status?: string; // e.g., "processing", "completed", "failed"
  thumbnailPath: string; // Path to thumbnail image
  duration: { seconds: number; minutes?: number }; // video length in seconds
  uploadDate: Date;
  uploadedBy?: mongoose.Types.ObjectId;
}

const VideoSchema: Schema<IVideo> = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, default: "processing" }, // Default status is "processing"
    thumbnailPath: { type: String },
    duration: {
      seconds: { type: Number },
      minutes: { type: Number },
    },
    uploadDate: { type: Date, default: Date.now },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);


const Video: Model<IVideo> =
  mongoose.models.Video || mongoose.model<IVideo>("Video", VideoSchema);

export default Video;
