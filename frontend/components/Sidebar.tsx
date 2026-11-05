"use client";

import React, { useState } from "react";
import { DocumentItem } from "@/types";
import { Search, Plus, RotateCw, Trash2 } from "lucide-react";

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
    <aside className="w-72 bg-[#000000] border-r border-[#222222] flex flex-col justify-between shrink-0 font-mono text-xs">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="p-3.5 flex items-center justify-between border-b border-[#222222]">
          <span className="font-semibold text-white tracking-wide">
            Documents
          </span>
          <div className="flex items-center space-x-1.5 text-[#A3A3A3]">
            <button
              onClick={() => setShowSearch(!showSearch)}
              title="Search"
              className="p-1 hover:text-white rounded hover:bg-[#141414] transition"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onOpenUpload}
              title="Upload file"
              className="p-1 hover:text-white rounded hover:bg-[#141414] transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        {showSearch && (
          <div className="p-2 border-b border-[#222222] bg-[#0A0A0A]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search files..."
              className="w-full bg-[#141414] border border-[#222222] rounded px-2.5 py-1.5 text-xs text-white placeholder-[#737373] focus:outline-none focus:border-white font-sans"
            />
          </div>
        )}

        {/* Select All Bar */}
        <div className="px-3.5 py-2 flex items-center justify-between text-[#A3A3A3] border-b border-[#141414] bg-[#0A0A0A]/60">
          <label className="flex items-center space-x-2 cursor-pointer select-none hover:text-white">
            <input
              type="checkbox"
              checked={allSelected}
              disabled={documents.length === 0}
              onChange={(e) => onToggleSelectAll(e.target.checked)}
              className="rounded bg-[#141414] border-[#333333] text-white focus:ring-0 w-3.5 h-3.5 cursor-pointer accent-white"
            />
            <span className="text-[11px]">Select all</span>
          </label>
          <button
            onClick={onRefresh}
            title="Refresh"
            className="hover:text-white transition"
          >
            <RotateCw className={`w-3 h-3 text-[#737373] hover:text-white ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Documents List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="text-[#737373] p-4 text-center">
              Loading...
            </div>
          ) : documents.length === 0 ? (
            <div className="text-[#737373] p-6 text-center space-y-1.5">
              <div className="text-white font-medium">No documents yet</div>
              <div className="text-[11px] text-[#737373] font-sans">
                Upload PDFs, DOCX, or text files to begin.
              </div>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-[#737373] p-4 text-center">
              No matching files.
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const ext = doc.source.split(".").pop()?.toUpperCase() || "TXT";
              const isChecked = selectedDocs.includes(doc.source);

              return (
                <div
                  key={doc.source}
                  onClick={() => onSelectDoc(doc.source)}
                  className="flex items-center justify-between px-2.5 py-2 rounded hover:bg-[#141414] cursor-pointer group transition select-none border border-transparent hover:border-[#222222]"
                >
                  <label
                    className="flex items-center space-x-2 truncate cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleDoc(doc.source)}
                      className="rounded bg-[#141414] border-[#333333] text-white focus:ring-0 w-3 h-3 accent-white"
                    />
                    <span className="text-[10px] text-[#737373] w-7 shrink-0 font-mono">
                      {ext}
                    </span>
                    <span
                      className="text-xs text-[#D4D4D4] truncate max-w-[155px] group-hover:text-white font-sans"
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
                    title="Delete"
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#737373] hover:text-white transition"
                  >
                    <Trash2 className="w-3 h-3" />
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
