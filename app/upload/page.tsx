import type { Metadata } from "next";
import UploadVideo from "@/component/UploadVideo";

export const metadata: Metadata = {
  title: "Upload Video",
  description: "Page for uploading videos",
};

export default function UploadPage() {
  return (
    <main className="p-8">
      <UploadVideo />
    </main>
  );
}
