"use client";

import React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface DocInspectorProps {
  filename: string;
  currentPage: number;
  totalPages: number;
  pageContent: string;
  highlightPhrase?: string;
  zoom: number;
  onPageChange: (newPage: number) => void;
  onZoomChange: (delta: number) => void;
  onClearHighlight: () => void;
}

export default function DocInspector({
  filename,
  currentPage,
  totalPages,
  pageContent,
  highlightPhrase,
  zoom,
  onPageChange,
  onZoomChange,
  onClearHighlight,
}: DocInspectorProps) {
  const hasDoc = !!filename && filename !== "--";

  // Helper to highlight matching phrase safely
  const renderHighlightedContent = () => {
    if (!pageContent) {
      return <p className="text-[#737373] font-mono">No text content available on this page.</p>;
    }

    const paragraphs = pageContent.split("\n\n");
    return paragraphs.map((para, i) => {
      let content: React.ReactNode = para.trim();

      if (
        highlightPhrase &&
        highlightPhrase.trim().length > 3 &&
        para.toLowerCase().includes(highlightPhrase.toLowerCase())
      ) {
        const parts = para.split(new RegExp(`(${escapeRegex(highlightPhrase)})`, "gi"));
        content = parts.map((part, pIdx) =>
          part.toLowerCase() === highlightPhrase.toLowerCase() ? (
            <span key={pIdx} className="citation-highlight">
              {part}
            </span>
          ) : (
            part
          )
        );
      }

      return (
        <p key={i} className="text-[#D4D4D4] leading-relaxed font-sans text-xs">
          {content}
        </p>
      );
    });
  };

  return (
    <aside className="w-[490px] bg-[#000000] flex flex-col justify-between overflow-hidden shrink-0 font-mono">
      {/* Header Toolbar */}
      <div className="h-9 px-3.5 border-b border-[#222222] flex items-center justify-between text-xs text-[#A3A3A3] select-none bg-[#0A0A0A]">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] tracking-wider text-[#737373] uppercase">
            DOCUMENT INSPECTOR
          </span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => onZoomChange(-10)}
            disabled={zoom <= 70}
            className="hover:text-white px-1 disabled:opacity-30"
          >
            -
          </button>
          <span className="text-[#D4D4D4] text-[11px]">{zoom}%</span>
          <button
            onClick={() => onZoomChange(10)}
            disabled={zoom >= 140}
            className="hover:text-white px-1 disabled:opacity-30"
          >
            +
          </button>
        </div>

        {/* Page Navigation */}
        <div className="flex items-center space-x-1.5 text-xs">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasDoc || currentPage <= 1}
            className="p-1 hover:text-white rounded hover:bg-[#141414] disabled:opacity-30 transition"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <span className="text-white text-[11px]">{hasDoc ? currentPage : 1}</span>
          <span className="text-[#737373] text-[11px]">/ {hasDoc ? totalPages : 1}</span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasDoc || currentPage >= totalPages}
            className="p-1 hover:text-white rounded hover:bg-[#141414] disabled:opacity-30 transition"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Clear Action */}
        <div>
          <button
            onClick={onClearHighlight}
            title="Reset Highlight"
            className="hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sheet View */}
      <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-[#000000]">
        {!hasDoc ? (
          /* Standby Empty State */
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3 my-auto">
            <div className="w-8 h-8 rounded border border-[#222222] bg-[#141414] flex items-center justify-center text-[#737373] font-mono text-xs">
              ∅
            </div>
            <div className="text-xs font-mono text-[#A3A3A3] uppercase tracking-wider">
              No Document Selected
            </div>
            <p className="text-[11px] text-[#525252] max-w-xs font-sans leading-relaxed">
              Select a document from the index repository or click a citation badge in chat to inspect verified source pages.
            </p>
          </div>
        ) : (
          /* Document Paper Sheet */
          <div
            style={{ transform: `scale(${zoom / 100})` }}
            className="w-full max-w-[440px] bg-[#0A0A0A] border border-[#222222] rounded p-6 text-[12px] text-[#D4D4D4] leading-relaxed space-y-4 transition-transform duration-150 origin-top h-fit"
          >
            {/* Header */}
            <div className="pb-2.5 border-b border-[#222222] text-[10px] font-mono tracking-widest text-[#A3A3A3] uppercase flex items-center justify-between">
              <span className="truncate max-w-[280px]" title={filename}>
                {filename}
              </span>
              <span className="text-[#525252]">PAGE VERIFIED</span>
            </div>

            {/* Content */}
            <div className="space-y-3 font-sans min-h-[300px]">
              {renderHighlightedContent()}
            </div>

            {/* Footer */}
            <div className="pt-4 text-center text-[10px] font-mono text-[#525252] border-t border-[#141414]">
              PAGE {currentPage} OF {totalPages}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

