"use client";

import React, { useState, useRef } from "react";
import { X, Upload, FileText, Trash2, Plus, Loader2 } from "lucide-react";

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void>;
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
  onUpload,
}: IngestModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
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
      // Deduplicate by filename
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
    try {
      await onUpload(selectedFiles);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onClose();
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-[#0A0A0A] border border-[#222222] rounded-lg p-6 w-full max-w-lg shadow-2xl space-y-4 font-sans text-xs">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[#222222] pb-3">
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
            className="text-[#737373] hover:text-white disabled:opacity-40 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Drag & Drop Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`border border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
              isDragging
                ? "border-white bg-[#1A1A1A]"
                : "border-[#333333] hover:border-[#555555] bg-[#121212]/50 hover:bg-[#141414]"
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-9 h-9 rounded-full bg-[#1A1A1A] border border-[#262626] flex items-center justify-center text-white/80">
                <Upload className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-white">
                  Click to browse or drag and drop multiple files
                </p>
                <p className="text-[11px] text-[#737373]">
                  Supports PDF, DOCX, and TXT files
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
                  className="text-[#737373] hover:text-[#EF4444] transition"
                >
                  Clear all
                </button>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 border border-[#222222] rounded p-2 bg-[#0E0E0E]">
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
                        className="text-[#737373] hover:text-white disabled:opacity-40 transition p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[#222222]">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center space-x-1.5 text-xs text-[#A3A3A3] hover:text-white disabled:opacity-40 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add more files</span>
            </button>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="px-3 py-1.5 text-xs text-[#A3A3A3] hover:text-white disabled:opacity-40 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || selectedFiles.length === 0}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-white hover:bg-[#E5E5E5] disabled:opacity-40 text-black text-xs font-semibold rounded transition"
              >
                {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {uploading
                    ? `Uploading ${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""}...`
                    : selectedFiles.length > 1
                    ? `Upload ${selectedFiles.length} Documents`
                    : "Upload Document"}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
