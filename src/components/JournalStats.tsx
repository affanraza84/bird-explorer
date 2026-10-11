import React from "react";
import { JournalStats as StatsType } from "@/lib/journal-utils";

interface JournalStatsProps {
  stats: StatsType;
  filteredCount?: number;
}

export function JournalStats({ stats, filteredCount }: JournalStatsProps) {
  const isFiltered =
    filteredCount !== undefined && filteredCount !== stats.totalObservations;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
      {/* Total Observations */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 shadow-xs">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {stats.totalObservations}
            </span>
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {stats.totalObservations === 1 ? "Observation" : "Observations"}
            </span>
          </div>
          {isFiltered && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Showing {filteredCount} matching
            </p>
          )}
        </div>
      </div>

      {/* Unique Species */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 shadow-xs">
        <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {stats.uniqueSpeciesCount}
            </span>
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Unique Species
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Normalized taxonomy
          </p>
        </div>
      </div>

      {/* High Confidence */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 shadow-xs">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {stats.highConfidenceCount}
            </span>
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              High Confidence
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Clear field marks identified
          </p>
        </div>
      </div>
    </div>
  );
}
