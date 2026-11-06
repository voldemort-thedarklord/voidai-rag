"use client";

import React from "react";
import { ChevronLeft, ChevronRight, X, ArrowLeft, ZoomIn, ZoomOut } from "lucide-react";

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
  onBackToChat?: () => void;
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
  onBackToChat,
}: DocInspectorProps) {
  const hasDoc = !!filename && filename !== "--";

  const renderHighlightedContent = () => {
    if (!pageContent) {
      return (
        <p className="text-[#737373] font-sans text-xs">
          No text content on this page.
        </p>
      );
    }

    const paragraphs = pageContent.split("\n\n");
    return paragraphs.map((para, i) => {
      let content: React.ReactNode = para.trim();

      if (
        highlightPhrase &&
        highlightPhrase.trim().length > 3 &&
        para.toLowerCase().includes(highlightPhrase.toLowerCase())
      ) {
        const parts = para.split(
          new RegExp(`(${escapeRegex(highlightPhrase)})`, "gi")
        );
        content = parts.map((part, pIdx) =>
          part.toLowerCase() === highlightPhrase.toLowerCase() ? (
            <span key={pIdx} className="citation-highlight font-semibold">
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
    <aside className="w-full lg:w-[420px] xl:w-[490px] bg-[#000000] flex flex-col justify-between overflow-hidden shrink-0 font-mono h-full">
      {/* Header Toolbar */}
      <div className="h-10 sm:h-9 px-2.5 sm:px-3.5 border-b border-[#222222] flex items-center justify-between text-xs text-[#A3A3A3] select-none bg-[#0A0A0A]">
        {/* Left: Mobile back button + Title */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {onBackToChat && (
            <button
              onClick={onBackToChat}
              className="lg:hidden flex items-center space-x-1 p-1 -ml-1 text-white hover:text-[#D4D4D4] active:scale-95 transition"
              title="Return to chat"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-[11px] font-semibold">Chat</span>
            </button>
          )}
          <span className="text-xs font-semibold text-white">Viewer</span>
        </div>

        {/* Center: Zoom Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs">
          <button
            onClick={() => onZoomChange(-10)}
            disabled={zoom <= 70}
            className="p-1 hover:text-white disabled:opacity-30 active:scale-95 transition"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5 sm:hidden" />
            <span className="hidden sm:inline font-bold">-</span>
          </button>
          <span className="text-[#D4D4D4] text-[11px] font-mono">{zoom}%</span>
          <button
            onClick={() => onZoomChange(10)}
            disabled={zoom >= 140}
            className="p-1 hover:text-white disabled:opacity-30 active:scale-95 transition"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5 sm:hidden" />
            <span className="hidden sm:inline font-bold">+</span>
          </button>
        </div>

        {/* Right: Page Navigation & Clear */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 text-xs">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasDoc || currentPage <= 1}
            className="p-1.5 sm:p-1 hover:text-white rounded hover:bg-[#141414] disabled:opacity-30 active:scale-95 transition"
            title="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
          </button>
          <span className="text-white text-[11px] font-mono">
            {hasDoc ? currentPage : 1}
          </span>
          <span className="text-[#737373] text-[11px] font-mono">
            /{hasDoc ? totalPages : 1}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasDoc || currentPage >= totalPages}
            className="p-1.5 sm:p-1 hover:text-white rounded hover:bg-[#141414] disabled:opacity-30 active:scale-95 transition"
            title="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
          </button>

          {highlightPhrase && (
            <button
              onClick={onClearHighlight}
              title="Clear highlight"
              className="p-1 ml-1 text-[#737373] hover:text-white active:scale-95 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Sheet View */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex justify-center bg-[#000000]">
        {!hasDoc ? (
          /* Standby Empty State */
          <div className="h-full flex flex-col items-center justify-center p-6 sm:p-8 text-center space-y-2 my-auto">
            <div className="text-xs sm:text-sm font-medium text-white">
              No document active
            </div>
            <p className="text-xs text-[#737373] max-w-xs font-sans leading-relaxed">
              Select a file from the Documents tab or tap a citation badge [1] in Chat to view the grounded excerpt.
            </p>
          </div>
        ) : (
          /* Document Sheet */
          <div
            style={{ transform: `scale(${zoom / 100})` }}
            className="w-full max-w-full sm:max-w-[440px] bg-[#0A0A0A] border border-[#222222] rounded-lg sm:rounded p-4 sm:p-6 text-[12px] text-[#D4D4D4] leading-relaxed space-y-3 sm:space-y-4 transition-transform duration-150 origin-top h-fit shadow-md"
          >
            {/* Header */}
            <div className="pb-2.5 border-b border-[#222222] text-xs font-mono text-white flex items-center justify-between">
              <span className="truncate max-w-[260px] sm:max-w-[320px]" title={filename}>
                {filename}
              </span>
            </div>

            {/* Content */}
            <div className="space-y-3 font-sans min-h-[200px] sm:min-h-[300px]">
              {renderHighlightedContent()}
            </div>

            {/* Footer */}
            <div className="pt-3 sm:pt-4 text-center text-[10px] font-mono text-[#525252] border-t border-[#141414]">
              Page {currentPage} of {totalPages}
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
