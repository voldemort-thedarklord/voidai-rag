"use client";

import React, { useState } from "react";
import { DocumentItem } from "@/types";
import { Search, Plus, RotateCw, Trash2, FileText, CheckSquare, Square } from "lucide-react";

interface SidebarProps {
  documents: DocumentItem[];
  selectedDocs: string[];
  onToggleSelectAll: (checked: boolean) => void;
  onToggleDoc: (source: string) => void;
  onSelectDoc: (source: string) => void;
  onDeleteDoc: (source: string) => void;
  onOpenUpload: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export default function Sidebar({
  documents,
  selectedDocs,
  onToggleSelectAll,
  onToggleDoc,
  onSelectDoc,
  onDeleteDoc,
  onOpenUpload,
  onRefresh,
  loading,
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const filteredDocs = documents.filter((doc) =>
    doc.source.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allSelected =
    documents.length > 0 && selectedDocs.length === documents.length;

  return (
    <aside className="w-full lg:w-64 xl:w-72 bg-[#000000] lg:border-r border-[#222222] flex flex-col justify-between shrink-0 font-mono text-xs h-full">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="p-3 sm:p-3.5 flex items-center justify-between border-b border-[#222222] bg-[#000000]">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-white tracking-wide text-xs sm:text-sm">
              Documents
            </span>
            <span className="text-[10px] text-[#737373] px-1.5 py-0.5 rounded bg-[#141414] border border-[#222222]">
              {documents.length}
            </span>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-1.5 text-[#A3A3A3]">
            <button
              onClick={() => setShowSearch(!showSearch)}
              title="Search"
              className="p-1.5 sm:p-1 hover:text-white rounded hover:bg-[#141414] active:scale-95 transition"
            >
              <Search className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
            <button
              onClick={onOpenUpload}
              title="Upload file"
              className="p-1.5 sm:p-1 hover:text-white rounded hover:bg-[#141414] active:scale-95 transition"
            >
              <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        {showSearch && (
          <div className="p-2.5 sm:p-2 border-b border-[#222222] bg-[#0A0A0A]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search files..."
              className="w-full bg-[#141414] border border-[#222222] rounded px-3 py-2 sm:py-1.5 text-xs text-white placeholder-[#737373] focus:outline-none focus:border-white font-sans"
            />
          </div>
        )}

        {/* Select All Bar */}
        <div className="px-3 sm:px-3.5 py-2 sm:py-2 flex items-center justify-between text-[#A3A3A3] border-b border-[#141414] bg-[#0A0A0A]/60 select-none">
          <label className="flex items-center space-x-2 cursor-pointer select-none hover:text-white py-0.5">
            <input
              type="checkbox"
              checked={allSelected}
              disabled={documents.length === 0}
              onChange={(e) => onToggleSelectAll(e.target.checked)}
              className="rounded bg-[#141414] border-[#333333] text-white focus:ring-0 w-4 h-4 sm:w-3.5 sm:h-3.5 cursor-pointer accent-white"
            />
            <span className="text-xs sm:text-[11px] font-sans">
              Select all ({selectedDocs.length}/{documents.length})
            </span>
          </label>
          <button
            onClick={onRefresh}
            title="Refresh"
            className="p-1 hover:text-white active:scale-95 transition"
          >
            <RotateCw className={`w-3.5 h-3.5 sm:w-3 sm:h-3 text-[#737373] hover:text-white ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Documents List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 sm:space-y-1">
          {loading ? (
            <div className="text-[#737373] p-6 text-center text-xs">
              Loading repository...
            </div>
          ) : documents.length === 0 ? (
            <div className="text-[#737373] p-8 text-center space-y-2">
              <FileText className="w-8 h-8 mx-auto text-[#404040]" />
              <div className="text-white font-medium text-xs sm:text-sm">No documents yet</div>
              <div className="text-[11px] text-[#737373] font-sans max-w-xs mx-auto">
                Upload PDFs, DOCX, or text files to begin asking grounded questions.
              </div>
              <button
                onClick={onOpenUpload}
                className="mt-2 inline-flex items-center space-x-1 px-3 py-1.5 rounded bg-white text-black text-xs font-semibold hover:bg-[#E5E5E5] transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Now</span>
              </button>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-[#737373] p-6 text-center text-xs">
              No matching files found.
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const ext = doc.source.split(".").pop()?.toUpperCase() || "TXT";
              const isChecked = selectedDocs.includes(doc.source);

              return (
                <div
                  key={doc.source}
                  onClick={() => onSelectDoc(doc.source)}
                  className="flex items-center justify-between px-2.5 py-2.5 sm:py-2 rounded-lg sm:rounded hover:bg-[#141414] active:bg-[#1A1A1A] cursor-pointer group transition select-none border border-transparent hover:border-[#222222]"
                >
                  <label
                    className="flex items-center space-x-2.5 truncate cursor-pointer flex-1 mr-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleDoc(doc.source)}
                      className="rounded bg-[#141414] border-[#333333] text-white focus:ring-0 w-4 h-4 sm:w-3 sm:h-3 accent-white cursor-pointer shrink-0"
                    />
                    <span className="text-[10px] text-[#737373] w-7 shrink-0 font-mono">
                      {ext}
                    </span>
                    <span
                      className="text-xs text-[#D4D4D4] truncate flex-1 group-hover:text-white font-sans text-left"
                      title={doc.source}
                    >
                      {doc.source}
                    </span>
                  </label>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDoc(doc.source);
                    }}
                    title="Delete document"
                    className="opacity-70 sm:opacity-0 group-hover:opacity-100 p-1.5 sm:p-1 text-[#737373] hover:text-[#EF4444] active:scale-95 transition shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
