import React from "react";
import {
  ConfidenceFilterOption,
  DateFilterOption,
  JournalFilters as FilterState,
} from "@/lib/journal-utils";

interface JournalFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClearFilters: () => void;
}

export function JournalFilters({
  filters,
  onFilterChange,
  onClearFilters,
}: JournalFiltersProps) {
  const hasActiveFilters =
    filters.searchQuery.trim() !== "" ||
    filters.confidence !== "all" ||
    filters.dateRange !== "all";

  return (
    <div className="space-y-3 p-4 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
      {/* Search Input Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <input
          type="text"
          value={filters.searchQuery}
          onChange={(e) =>
            onFilterChange({ ...filters, searchQuery: e.target.value })
          }
          placeholder="Search your observations..."
          className="w-full pl-9 pr-9 py-2 text-sm bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
        />

        {filters.searchQuery && (
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, searchQuery: "" })}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            title="Clear search"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter Selectors Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs">
          {/* Confidence Filter */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="confidence-filter"
              className="font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap"
            >
              Confidence:
            </label>
            <select
              id="confidence-filter"
              value={filters.confidence}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  confidence: e.target.value as ConfidenceFilterOption,
                })
              }
              className="py-1 px-2.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="date-filter"
              className="font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap"
            >
              Date:
            </label>
            <select
              id="date-filter"
              value={filters.dateRange}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  dateRange: e.target.value as DateFilterOption,
                })
              }
              className="py-1 px-2.5 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
            </select>
          </div>
        </div>

        {/* Clear Filters Action */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium underline underline-offset-2 cursor-pointer transition-colors"
          >
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
}
