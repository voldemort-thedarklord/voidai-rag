"use client";

import React, { Suspense } from "react";
import { UserButton, SignInButton, SignUpButton, Show } from "@clerk/nextjs";
import { Plus } from "lucide-react";

interface HeaderProps {
  onOpenUpload: () => void;
  engine: "gemini" | "ollama";
  onEngineChange: (engine: "gemini" | "ollama") => void;
}

export default function Header({
  onOpenUpload,
  engine,
  onEngineChange,
}: HeaderProps) {
  return (
    <header className="w-full max-w-[1420px] mx-auto flex items-center justify-between pb-3.5 border-b border-[#222222]">
      {/* Brand */}
      <div className="flex items-center space-x-2.5">
        <div className="w-5 h-5 border border-white/20 bg-[#141414] rounded flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-xs"></div>
        </div>
        <span className="text-sm font-semibold tracking-wide text-white lowercase font-mono">
          voidai
        </span>
      </div>

      {/* Center: Engine Toggle (Cloud Gemini vs Local Ollama) */}
      <div className="inline-flex p-0.5 bg-[#0A0A0A] rounded-md border border-[#222222] font-mono text-[11px]">
        <button
          onClick={() => onEngineChange("gemini")}
          className={`px-2.5 py-1 rounded transition ${
            engine === "gemini"
              ? "bg-white text-black font-semibold shadow-xs"
              : "text-[#737373] hover:text-white"
          }`}
          title="Google Gemini Cloud (Free, fast)"
        >
          Cloud (Gemini)
        </button>
        <button
          onClick={() => onEngineChange("ollama")}
          className={`px-2.5 py-1 rounded transition ${
            engine === "ollama"
              ? "bg-white text-black font-semibold shadow-xs"
              : "text-[#737373] hover:text-white"
          }`}
          title="Local Ollama (Private, offline)"
        >
          Local (Ollama)
        </button>
      </div>

      {/* Right Controls: Upload & Auth */}
      <div className="flex items-center space-x-3 text-xs font-mono">
        <button
          onClick={onOpenUpload}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-black bg-white hover:bg-[#E5E5E5] rounded-md transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload</span>
        </button>

        {/* Clerk Auth */}
        <Suspense fallback={<div className="w-6 h-6 rounded-full bg-[#141414] animate-pulse" />}>
          <Show when="signed-in">
            <div className="pl-1 border-l border-[#222222]">
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: "w-6 h-6 border border-[#333333]",
                  },
                }}
              />
            </div>
          </Show>
          <Show when="signed-out">
            <div className="flex items-center space-x-2">
              <SignInButton mode="modal">
                <button className="px-3 py-1.5 text-xs text-[#D4D4D4] hover:text-white bg-[#141414] border border-[#222222] hover:border-[#525252] rounded-md transition">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-3 py-1.5 text-xs text-black font-semibold bg-white hover:bg-[#E5E5E5] rounded-md transition">
                  Sign up
                </button>
              </SignUpButton>
            </div>
          </Show>
        </Suspense>
      </div>
    </header>
  );
}
