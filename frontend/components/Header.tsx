"use client";

import React, { Suspense } from "react";
import { UserButton, SignInButton, SignUpButton, Show } from "@clerk/nextjs";

interface HeaderProps {
  currentRole: string;
  onRoleChange: (role: string) => void;
  onOpenIngest: () => void;
  onOpenEval: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Header({
  currentRole,
  onRoleChange,
  onOpenIngest,
  onOpenEval,
  activeTab,
  onTabChange,
}: HeaderProps) {
  return (
    <header className="w-full max-w-[1420px] mx-auto flex items-center justify-between pb-3.5 border-b border-[#222222]">
      {/* Brand / Title */}
      <div className="flex items-center space-x-3">
        <div className="w-6 h-6 border border-white/20 bg-[#141414] rounded flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-white rounded-sm"></div>
        </div>
        <div className="flex items-center space-x-2 font-mono">
          <span className="text-xs font-semibold tracking-wider uppercase text-white">VOIDAI</span>
          <span className="text-[10px] text-[#737373] tracking-tight">// intelligence</span>
        </div>
      </div>

      {/* Center Navigation Tabs (Strictly Minimalist Monochrome) */}
      <div className="inline-flex p-0.5 bg-[#0A0A0A] rounded-lg border border-[#222222] font-mono">
        <button
          onClick={() => onTabChange("knowledge")}
          className={`px-4 py-1 text-xs font-medium rounded-md transition ${
            activeTab === "knowledge"
              ? "text-black bg-white shadow-sm"
              : "text-[#A3A3A3] hover:text-white"
          }`}
        >
          Knowledge Base
        </button>
        <button
          onClick={onOpenEval}
          className="px-4 py-1 text-xs font-medium text-[#A3A3A3] hover:text-white rounded-md transition flex items-center gap-1.5"
        >
          <span>Benchmarks</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#737373]"></span>
        </button>
        <button
          onClick={onOpenIngest}
          className="px-4 py-1 text-xs font-medium text-[#A3A3A3] hover:text-white rounded-md transition"
        >
          + Ingest
        </button>
      </div>

      {/* Right Controls: Role Selector & Clerk Auth */}
      <div className="flex items-center space-x-3 text-xs font-mono">
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded border border-[#222222] bg-[#0A0A0A] text-[#A3A3A3] text-[11px]">
          <span className="text-[#737373]">ROLE:</span>
          <select
            value={currentRole}
            onChange={(e) => onRoleChange(e.target.value)}
            className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
          >
            <option value="Admin" className="bg-[#141414] text-white">ADMIN</option>
            <option value="Executive" className="bg-[#141414] text-white">EXECUTIVE</option>
            <option value="HR Manager" className="bg-[#141414] text-white">HR MANAGER</option>
            <option value="Software Engineer" className="bg-[#141414] text-white">ENGINEER</option>
            <option value="Finance Analyst" className="bg-[#141414] text-white">FINANCE</option>
            <option value="General Employee" className="bg-[#141414] text-white">GENERAL</option>
          </select>
        </div>

        {/* Visible Clerk Authentication Controls */}
        <Suspense fallback={<div className="w-6 h-6 rounded-full bg-[#141414] animate-pulse" />}>
          <Show when="signed-in">
            <div className="flex items-center space-x-2 pl-1 border-l border-[#222222]">
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
            <div className="flex items-center space-x-2 font-mono">
              <SignInButton mode="modal">
                <button className="px-2.5 py-1 text-[11px] font-mono text-[#D4D4D4] hover:text-white bg-[#141414] border border-[#222222] hover:border-[#525252] rounded transition">
                  SIGN IN
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-2.5 py-1 text-[11px] font-mono text-black font-semibold bg-white hover:bg-[#E5E5E5] rounded transition">
                  SIGN UP
                </button>
              </SignUpButton>
            </div>
          </Show>
        </Suspense>
      </div>
    </header>
  );
}
