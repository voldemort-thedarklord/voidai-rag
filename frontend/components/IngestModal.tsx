"use client";

import React, { useState, useRef } from "react";
import { X, Upload, FileText, Plus, Loader2 } from "lucide-react";

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSingle: (file: File) => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];

function isAllowedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export default function IngestModal({
  isOpen,
  onClose,
  onUploadSingle,
}: IngestModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFilesAdded = (newFiles: FileList | File[]) => {
    const validFiles: File[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      if (isAllowedFile(file)) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      alert("Please select supported files (.pdf, .docx, or .txt)");
      return;
    }

    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const filtered = validFiles.filter((f) => !existingNames.has(f.name));
      return [...prev, ...filtered];
    });
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0 || uploading) return;

    setUploading(true);
    const queue = [...selectedFiles];
    const errors: string[] = [];
    let completedCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const file = queue[i];
      setProgressStatus(`Uploading ${file.name} (${i + 1}/${queue.length})...`);
      try {
        await onUploadSingle(file);
        completedCount++;
        setSelectedFiles((prev) => prev.filter((f) => f.name !== file.name));
      } catch (err: any) {
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    setUploading(false);
    setProgressStatus("");

    if (errors.length > 0) {
      alert(`Some files failed to upload:\n\n${errors.join("\n")}`);
    }

    if (completedCount > 0 && errors.length === 0) {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onClose();
    }
  };

  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl sm:rounded-lg p-4 sm:p-6 w-full max-w-lg shadow-2xl space-y-3.5 sm:space-y-4 font-sans text-xs max-h-[90dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[#222222] pb-3 shrink-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-semibold text-white">Upload Documents</h3>
            {selectedFiles.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1A1A1A] text-[#A3A3A3] border border-[#262626]">
                {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-1 text-[#737373] hover:text-white disabled:opacity-40 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4 flex flex-col flex-1 overflow-hidden">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            onChange={(e) => {
              if (e.target.files) {
                handleFilesAdded(e.target.files);
              }
            }}
            className="hidden"
          />

          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {/* Drag & Drop / Tap to Browse Area */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`border border-dashed rounded-lg p-5 sm:p-6 text-center cursor-pointer transition select-none ${
                isDragging
                  ? "border-white bg-[#1A1A1A]"
                  : "border-[#333333] hover:border-[#555555] bg-[#121212]/50 hover:bg-[#141414] active:bg-[#181818]"
              }`}
            >
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-[#1A1A1A] border border-[#262626] flex items-center justify-center text-white">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white">
                    Tap to select files or drag & drop
                  </p>
                  <p className="text-[11px] text-[#737373]">
                    PDF, DOCX, and TXT (Multiple files supported)
                  </p>
                </div>
              </div>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#A3A3A3] px-0.5">
                  <span>
                    Selected ({selectedFiles.length}) • {formatBytes(totalSize)}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={uploading}
                    className="text-[#737373] hover:text-[#EF4444] transition p-0.5"
                  >
                    Clear all
                  </button>
                </div>

                <div className="max-h-36 sm:max-h-44 overflow-y-auto space-y-1.5 border border-[#222222] rounded p-2 bg-[#0E0E0E]">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between p-2 rounded bg-[#161616] border border-[#222222] text-xs hover:border-[#333333] transition"
                    >
                      <div className="flex items-center space-x-2.5 truncate mr-2">
                        <FileText className="w-3.5 h-3.5 text-[#A3A3A3] shrink-0" />
                        <span className="truncate text-white font-mono text-[11px]">
                          {file.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-[10px] text-[#737373] font-mono">
                          {formatBytes(file.size)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(idx);
                          }}
                          disabled={uploading}
                          className="p-1 text-[#737373] hover:text-[#EF4444] disabled:opacity-40 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress status banner when uploading */}
            {uploading && progressStatus && (
              <div className="flex items-center space-x-2 px-3 py-2 bg-[#141414] border border-[#2A2A2A] rounded text-[11px] text-white font-mono">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white shrink-0" />
                <span className="truncate">{progressStatus}</span>
              </div>
            )}
          </div>

          {/* Sticky footer actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[#222222] shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center space-x-1.5 text-xs text-[#A3A3A3] hover:text-white disabled:opacity-40 transition py-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add more</span>
            </button>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="px-3 py-2 sm:py-1.5 text-xs text-[#A3A3A3] hover:text-white disabled:opacity-40 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || selectedFiles.length === 0}
                className="flex items-center space-x-1.5 px-3.5 py-2 sm:py-1.5 bg-white hover:bg-[#E5E5E5] active:scale-95 disabled:opacity-40 text-black text-xs font-semibold rounded transition"
              >
                {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {uploading
                    ? "Uploading..."
                    : selectedFiles.length > 1
                    ? `Upload (${selectedFiles.length})`
                    : "Upload"}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
