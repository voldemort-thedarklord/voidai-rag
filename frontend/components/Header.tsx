"use client";

import React, { Suspense } from "react";
import { UserButton, SignInButton, SignUpButton, Show } from "@clerk/nextjs";
import { Plus } from "lucide-react";

interface HeaderProps {
  onOpenUpload: () => void;
}

export default function Header({ onOpenUpload }: HeaderProps) {
  return (
    <header className="w-full max-w-[1420px] mx-auto flex items-center justify-between pb-3 border-b border-[#222222]">
      {/* Brand */}
      <div className="flex items-center space-x-2">
        <div className="w-5 h-5 border border-white/20 bg-[#141414] rounded flex items-center justify-center shrink-0">
          <div className="w-2 h-2 bg-white rounded-xs"></div>
        </div>
        <span className="text-sm font-semibold tracking-wide text-white lowercase font-mono">
          voidai
        </span>
      </div>

      {/* Right Controls: Upload & Auth */}
      <div className="flex items-center space-x-2 sm:space-x-3 text-xs font-mono">
        <button
          onClick={onOpenUpload}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-xs font-semibold text-black bg-white hover:bg-[#E5E5E5] active:scale-95 rounded-md transition select-none"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Upload</span>
        </button>

        {/* Clerk Auth */}
        <Suspense fallback={<div className="w-6 h-6 rounded-full bg-[#141414] animate-pulse" />}>
          <Show when="signed-in">
            <div className="pl-1 sm:pl-2 border-l border-[#222222] flex items-center">
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
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <SignInButton mode="modal">
                <button className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-xs text-[#D4D4D4] hover:text-white bg-[#141414] border border-[#222222] hover:border-[#525252] rounded-md transition">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-xs text-black font-semibold bg-white hover:bg-[#E5E5E5] rounded-md transition">
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
