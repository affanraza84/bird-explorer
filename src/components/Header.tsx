"use client";

import { useEffect, useState } from "react";

interface StatusState {
  available: boolean;
  model: string;
  modelFound: boolean;
  checked: boolean;
}

export function Header() {
  const [status, setStatus] = useState<StatusState>({
    available: false,
    model: "qwen2.5vl:3b",
    modelFound: false,
    checked: false,
  });

  useEffect(() => {
    let isMounted = true;
    async function checkStatus() {
      try {
        const res = await fetch("/api/status");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setStatus({
              available: data.available,
              model: data.model,
              modelFound: data.modelFound,
              checked: true,
            });
          }
        } else {
          if (isMounted) setStatus((prev) => ({ ...prev, checked: true }));
        }
      } catch {
        if (isMounted) setStatus((prev) => ({ ...prev, checked: true }));
      }
    }
    checkStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <header className="border-b border-emerald-950/10 dark:border-emerald-500/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              Bird Explorer
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                Milestone 1
              </span>
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Outdoor AI • Touch Grass Challenge
            </p>
          </div>
        </div>

        {/* Local AI status badge */}
        <div className="flex items-center gap-2 text-xs font-medium px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300 shadow-sm">
          <span className="relative flex h-2 w-2">
            {status.checked && status.available ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </>
            ) : status.checked ? (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-400"></span>
            )}
          </span>
          <span>Local AI • Ollama</span>
          {status.checked && (
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded font-mono ${
                status.available
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {status.available ? status.model : "offline"}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
