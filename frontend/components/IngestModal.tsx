"use client";

import React, { useState } from "react";
import { X } from "lucide-react";

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
}

export default function IngestModal({
  isOpen,
  onClose,
  onUpload,
}: IngestModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || uploading) return;

    setUploading(true);
    try {
      await onUpload(selectedFile);
      setSelectedFile(null);
      onClose();
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-[#0A0A0A] border border-[#222222] rounded-lg p-6 w-full max-w-md shadow-2xl space-y-4 font-sans text-xs">
        <div className="flex justify-between items-center border-b border-[#222222] pb-3">
          <h3 className="text-sm font-semibold text-white">
            Upload Document
          </h3>
          <button onClick={onClose} className="text-[#737373] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[#A3A3A3] mb-2 text-xs">
              Select a file (.pdf, .docx, or .txt)
            </label>
            <input
              type="file"
              required
              accept=".pdf,.docx,.txt"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-[#D4D4D4] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-white file:text-black hover:file:bg-[#E5E5E5] bg-[#141414] border border-[#222222] rounded p-2 cursor-pointer font-sans"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-[#222222]">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-3 py-1.5 text-xs text-[#A3A3A3] hover:text-white disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="px-4 py-1.5 bg-white hover:bg-[#E5E5E5] disabled:opacity-40 text-black text-xs font-semibold rounded transition"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
