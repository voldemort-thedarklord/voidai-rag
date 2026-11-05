"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, Citation } from "@/types";
import { ArrowUp, Copy } from "lucide-react";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (query: string) => Promise<void>;
  onCitationClick: (source: string, page: number, snippet: string) => void;
  selectedCount: number;
  loading: boolean;
}

export default function ChatPanel({
  messages,
  onSendMessage,
  onCitationClick,
  selectedCount,
  loading,
}: ChatPanelProps) {
  const [inputQuery, setInputQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputQuery.trim();
    if (!query || loading) return;
    setInputQuery("");
    onSendMessage(query);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard.");
  };

  const renderFormattedText = (text: string, citations?: Citation[]) => {
    const formatted = text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");

    return (
      <div className="space-y-2 leading-relaxed">
        <div
          dangerouslySetInnerHTML={{ __html: formatted }}
          className="whitespace-pre-wrap font-sans text-xs"
        />
        {citations && citations.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center pt-1 font-mono">
            {citations.map((c, idx) => (
              <span
                key={idx}
                onClick={() =>
                  onCitationClick(c.source, c.page, c.excerpt_snippet || "")
                }
                title={`${c.source} (Page ${c.page})`}
                className="citation-badge"
              >
                {idx + 1}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="flex-1 bg-[#0A0A0A] flex flex-col justify-between overflow-hidden border-r border-[#222222]">
      {/* Messages Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Simple Initial Welcome */}
        <div className="flex items-start space-x-2.5 max-w-[85%]">
          <div className="bg-[#141414] border border-[#222222] text-[#D4D4D4] text-xs px-4 py-3 rounded-xl rounded-tl-sm shadow-sm leading-relaxed font-sans">
            <div className="text-white font-medium mb-1">
              Welcome to voidai
            </div>
            <div className="text-[#A3A3A3] text-xs">
              Upload your documents and ask any question. Answers are grounded in your files with exact citations.
            </div>
          </div>
        </div>

        {/* Dynamic Chat Messages */}
        {messages.map((msg) =>
          msg.sender === "user" ? (
            <div key={msg.id} className="flex justify-end">
              <div className="bg-white text-black text-xs font-medium px-4 py-2.5 rounded-xl rounded-tr-sm shadow-sm max-w-[80%] leading-relaxed font-sans">
                {msg.text}
              </div>
            </div>
          ) : (
            <div key={msg.id} className="flex flex-col space-y-2 max-w-[92%]">
              <div className="bg-[#141414] border border-[#222222] text-[#E5E5E5] text-xs px-4 py-3.5 rounded-xl rounded-tl-sm shadow-sm leading-relaxed space-y-2">
                {renderFormattedText(msg.text, msg.citations)}
              </div>
              <div className="flex items-center space-x-3 text-[#737373] text-[11px] pl-2 font-mono">
                <button
                  onClick={() => copyText(msg.text)}
                  className="hover:text-white transition flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
                {msg.metrics?.provider && (
                  <span className="text-[10px] text-[#525252]">
                    via {msg.metrics.provider === "gemini" ? "Cloud Gemini" : "Local Ollama"}
                    {msg.metrics.total_latency_ms ? ` (${(msg.metrics.total_latency_ms / 1000).toFixed(1)}s)` : ""}
                  </span>
                )}
              </div>
            </div>
          )
        )}

        {/* Searching Indicator */}
        {loading && (
          <div className="flex items-start space-x-2 max-w-[90%]">
            <div className="bg-[#141414] border border-[#222222] text-[#A3A3A3] text-xs px-4 py-3 rounded-xl rounded-tl-sm flex items-center space-x-2 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              <span>Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-3.5 bg-[#000000] border-t border-[#222222]">
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center bg-[#141414] border border-[#333333] rounded-xl px-3.5 py-2.5 focus-within:border-white transition"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={loading}
            placeholder="Ask a question about your documents..."
            className="w-full bg-transparent text-xs text-white placeholder-[#737373] focus:outline-none pr-32 font-sans"
          />

          <div className="absolute right-2 flex items-center space-x-2 font-mono">
            {/* Active Sources Badge */}
            <div className="px-2 py-0.5 bg-[#222222] border border-[#333333] rounded text-[10px] text-[#A3A3A3] select-none">
              <span>{selectedCount} files</span>
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={loading || !inputQuery.trim()}
              className="w-6 h-6 rounded bg-white hover:bg-[#E5E5E5] disabled:opacity-40 text-black flex items-center justify-center transition"
              title="Send"
            >
              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
