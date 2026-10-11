"use client";

import { useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineStatus() {
  const isOnline = useOnlineStatus();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="relative inline-block text-xs">
      <button
        type="button"
        onClick={() => setShowDetails((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer border ${
          isOnline
            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
            : "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 animate-pulse"
        }`}
        title={
          isOnline
            ? "Connected to network. Click for details."
            : "Offline mode active. Click for details."
        }
      >
        <span
          className={`w-2 h-2 rounded-full ${
            isOnline ? "bg-emerald-500" : "bg-amber-500"
          }`}
        />
        <span>{isOnline ? "Online" : "Offline"}</span>
      </button>

      {/* Offline information banner popover */}
      {(!isOnline || showDetails) && (
        <div
          className={`absolute right-0 sm:right-auto sm:left-0 mt-2 w-72 sm:w-80 p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 text-xs space-y-2 ${
            !isOnline ? "block" : showDetails ? "block" : "hidden"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>{isOnline ? "🟢 Network Connected" : "🟡 Offline Mode Active"}</span>
            </span>
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-0.5"
            >
              ✕
            </button>
          </div>

          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-[11px]">
            {isOnline
              ? "All features including local Ollama AI inference and offline field journals are active."
              : "You're offline. Your journal, GPS validation, audio recording, and outdoor tools remain available. AI identification requires the local AI service."}
          </p>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400 dark:text-zinc-500">
            PWA Service Worker active • Cached for outdoor use
          </div>
        </div>
      )}
    </div>
  );
}
