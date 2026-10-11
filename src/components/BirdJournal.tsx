"use client";

import { useEffect, useState, useRef, useMemo, useSyncExternalStore } from "react";
import Image from "next/image";
import { BirdSighting } from "@/types/bird";
import {
  getSightings,
  deleteSighting,
  clearSightings,
  isIndexedDBAvailable,
} from "@/lib/bird-journal";
import {
  filterSightings,
  calculateJournalStats,
  JournalFilters as FilterState,
} from "@/lib/journal-utils";
import {
  exportJournalAsJSON,
  exportJournalAsCSV,
} from "@/lib/journal-export";
import { JournalStats } from "@/components/JournalStats";
import { JournalFilters } from "@/components/JournalFilters";
import { ObservationModal } from "@/components/ObservationModal";

interface BirdJournalProps {
  refreshTrigger?: number;
}

export interface SightingWithPreview extends BirdSighting {
  previewUrl: string;
}

const DEFAULT_FILTERS: FilterState = {
  searchQuery: "",
  confidence: "all",
  dateRange: "all",
};

const emptySubscribe = () => () => {};
let cachedClientNow = 0;
const getClientNow = () => {
  if (!cachedClientNow && typeof window !== "undefined") {
    cachedClientNow = Date.now();
  }
  return cachedClientNow;
};
const getServerSnapshot = () => 0;

export function BirdJournal({ refreshTrigger = 0 }: BirdJournalProps) {
  const clientNow = useSyncExternalStore(emptySubscribe, getClientNow, getServerSnapshot);
  const [sightings, setSightings] = useState<SightingWithPreview[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [selectedSighting, setSelectedSighting] = useState<SightingWithPreview | null>(null);

  // Keep track of active object URLs for cleanup
  const activeUrlsRef = useRef<Set<string>>(new Set());

  // Revoke all active object URLs
  const revokeAllUrls = () => {
    activeUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore error during cleanup
      }
    });
    activeUrlsRef.current.clear();
  };

  // Cleanup all object URLs when component unmounts
  useEffect(() => {
    return () => {
      revokeAllUrls();
    };
  }, []);

  // Load sightings from IndexedDB when mounted or when refreshTrigger changes
  useEffect(() => {
    let isMounted = true;

    async function loadJournal() {
      if (!isIndexedDBAvailable()) {
        if (isMounted) {
          setIsLoading(false);
          setErrorMessage(
            "IndexedDB is not available in your browser environment. Journal entries cannot be stored locally."
          );
        }
        return;
      }

      try {
        setErrorMessage(null);
        const rawData = await getSightings();

        if (isMounted) {
          // Revoke previous URLs before creating new ones
          revokeAllUrls();

          const loadedEntries: SightingWithPreview[] = rawData.map((sighting) => {
            let previewUrl = "";
            if (sighting.image instanceof Blob) {
              try {
                previewUrl = URL.createObjectURL(sighting.image);
                activeUrlsRef.current.add(previewUrl);
              } catch (err) {
                console.error("Failed to create preview URL:", err);
              }
            }
            return {
              ...sighting,
              previewUrl,
            };
          });

          setSightings(loadedEntries);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : "Failed to load bird journal entries from local storage."
          );
          setIsLoading(false);
        }
      }
    }

    loadJournal();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  // Handle single item deletion
  const handleDelete = async (sighting: SightingWithPreview) => {
    if (deletingId) return;

    setDeletingId(sighting.id);
    setErrorMessage(null);

    try {
      await deleteSighting(sighting.id);

      // Revoke the specific object URL
      if (sighting.previewUrl) {
        try {
          URL.revokeObjectURL(sighting.previewUrl);
          activeUrlsRef.current.delete(sighting.previewUrl);
        } catch {
          // Ignore
        }
      }

      setSightings((prev) => prev.filter((s) => s.id !== sighting.id));
      if (selectedSighting?.id === sighting.id) {
        setSelectedSighting(null);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to delete sighting from journal."
      );
    } finally {
      setDeletingId(null);
    }
  };

  // Handle clearing all sightings
  const handleClearAll = async () => {
    setIsClearing(true);
    setErrorMessage(null);

    try {
      await clearSightings();
      revokeAllUrls();
      setSightings([]);
      setSelectedSighting(null);
      setIsConfirmingClear(false);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to clear bird journal."
      );
    } finally {
      setIsClearing(false);
    }
  };

  // Handle JSON Export
  const handleExportJson = async () => {
    if (sightings.length === 0) {
      setInfoMessage("There are no observations to export yet.");
      setTimeout(() => setInfoMessage(null), 4000);
      return;
    }

    setIsExportingJson(true);
    setErrorMessage(null);

    try {
      await exportJournalAsJSON(sightings);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to export journal as JSON."
      );
    } finally {
      setIsExportingJson(false);
    }
  };

  // Handle CSV Export
  const handleExportCsv = () => {
    if (sightings.length === 0) {
      setInfoMessage("There are no observations to export yet.");
      setTimeout(() => setInfoMessage(null), 4000);
      return;
    }

    setErrorMessage(null);

    try {
      exportJournalAsCSV(sightings);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to export journal as CSV."
      );
    }
  };

  // Computed journal statistics (always based on complete journal)
  const journalStats = useMemo(() => {
    return calculateJournalStats(sightings);
  }, [sightings]);

  // Computed filtered sightings
  const filteredSightings = useMemo(() => {
    return filterSightings(sightings, filters, clientNow ?? undefined);
  }, [sightings, filters, clientNow]);

  const formatDate = (timestamp: number) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(timestamp));
    } catch {
      return new Date(timestamp).toLocaleString();
    }
  };

  return (
    <section className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              My Bird Journal
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
              {sightings.length} {sightings.length === 1 ? "Sighting" : "Sightings"}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Persisted locally in your browser via IndexedDB • Works offline
          </p>
        </div>

        {/* Action Buttons: Export & Clear */}
        <div className="flex flex-wrap items-center gap-2">
          {sightings.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportJson}
                disabled={isExportingJson}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                title="Export all observations including base64 photos as JSON"
              >
                {isExportingJson ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Exporting JSON…</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Export All JSON</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                title="Export all observations as a spreadsheet-compatible CSV"
              >
                <svg className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Export All CSV</span>
              </button>
            </>
          )}

          {sightings.length > 0 && !isConfirmingClear && (
            <button
              type="button"
              onClick={() => setIsConfirmingClear(true)}
              className="text-xs text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 font-medium transition-colors cursor-pointer px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-900/50"
            >
              Clear Journal
            </button>
          )}
        </div>
      </div>

      {/* Clear Confirmation Banner */}
      {isConfirmingClear && (
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-sm">
            <p className="font-semibold">Clear all journal sightings?</p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
              This will permanently remove all {sightings.length} recorded birds from your local browser storage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsConfirmingClear(false)}
              disabled={isClearing}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={isClearing}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {isClearing ? "Clearing..." : "Yes, Clear All"}
            </button>
          </div>
        </div>
      )}

      {/* Info Notification Banner */}
      {infoMessage && (
        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
          <span>{infoMessage}</span>
          <button
            type="button"
            onClick={() => setInfoMessage(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Statistics Banner */}
      {sightings.length > 0 && (
        <JournalStats
          stats={journalStats}
          filteredCount={filteredSightings.length}
        />
      )}

      {/* Search and Filter Controls */}
      {sightings.length > 0 && (
        <JournalFilters
          filters={filters}
          onFilterChange={setFilters}
          onClearFilters={() => setFilters(DEFAULT_FILTERS)}
        />
      )}

      {/* Main Content Area */}
      {isLoading ? (
        /* Loading State */
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400 dark:text-zinc-500">
          <svg className="animate-spin h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">Loading your local bird journal…</span>
        </div>
      ) : sightings.length === 0 ? (
        /* Completely Empty Journal State */
        <div className="py-12 px-6 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Your Bird Journal is empty
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mt-1">
              Identify your first bird to start building your personal nature journal.
            </p>
          </div>
        </div>
      ) : filteredSightings.length === 0 ? (
        /* Search / Filter Yielded No Matches State */
        <div className="py-12 px-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              No matching observations
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mt-1">
              Try a different search or filter.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="mt-1 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors shadow-xs"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* Improved Responsive Observation Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSightings.map((sighting) => {
            const isDeletingThis = deletingId === sighting.id;

            return (
              <article
                key={sighting.id}
                className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-md shadow-zinc-950/5 overflow-hidden flex flex-col justify-between transition-all hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg"
              >
                <div>
                  {/* Photo Thumbnail */}
                  <div
                    onClick={() => setSelectedSighting(sighting)}
                    className="relative w-full h-48 bg-zinc-950 flex items-center justify-center overflow-hidden border-b border-zinc-100 dark:border-zinc-800 cursor-pointer"
                    title="Click to view full photo and details"
                  >
                    {sighting.previewUrl ? (
                      <Image
                        src={sighting.previewUrl}
                        alt={sighting.species}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-950 flex flex-col items-center justify-center p-4 text-center">
                        <span className="text-3xl mb-1">🔭</span>
                        <span className="text-xs font-semibold text-emerald-400">Field Observation</span>
                        <span className="text-[10px] text-zinc-500">No photo attached</span>
                      </div>
                    )}

                    <span className="absolute top-2.5 right-2.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-900/80 backdrop-blur-sm text-zinc-200 border border-zinc-700/60">
                      {sighting.confidence}
                    </span>
                  </div>

                  {/* Card Body Info */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <time
                        dateTime={new Date(sighting.createdAt).toISOString()}
                        className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500"
                      >
                        {formatDate(sighting.createdAt)}
                      </time>

                      {sighting.audio && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
                          <span>🎙️</span>
                          <span>
                            {typeof sighting.audioDurationMs === "number"
                              ? `${Math.round(sighting.audioDurationMs / 1000)}s`
                              : "Audio note"}
                          </span>
                        </span>
                      )}
                    </div>

                    <h3
                      onClick={() => setSelectedSighting(sighting)}
                      className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight leading-snug cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors line-clamp-1"
                      title={sighting.species}
                    >
                      {sighting.species}
                    </h3>

                    {/* Metadata Badges */}
                    {(sighting.habitat || sighting.weatherCondition || (sighting.tags && sighting.tags.length > 0)) && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {sighting.habitat && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 capitalize">
                            🌿 {sighting.habitat}
                          </span>
                        )}
                        {sighting.weatherCondition && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 capitalize">
                            ⛅ {sighting.weatherCondition}
                          </span>
                        )}
                        {sighting.tags?.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 capitalize"
                          >
                            {t}
                          </span>
                        ))}
                        {sighting.tags && sighting.tags.length > 2 && (
                          <span className="text-[10px] text-zinc-400">
                            +{sighting.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 line-clamp-2">
                      {sighting.description}
                    </p>
                  </div>
                </div>

                {/* Footer Action Buttons: View Details & Delete */}
                <div className="px-4 py-3 bg-zinc-50/70 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedSighting(sighting)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 rounded-md transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800/60"
                  >
                    <span>View Details</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(sighting)}
                    disabled={isDeletingThis}
                    className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                    title="Delete observation"
                    aria-label={`Delete observation for ${sighting.species}`}
                  >
                    {isDeletingThis ? (
                      <span className="text-[10px] text-red-500">Deleting…</span>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Observation Detail Modal */}
      <ObservationModal
        sighting={selectedSighting}
        onClose={() => setSelectedSighting(null)}
        onSightingUpdated={(updated) => {
          setSelectedSighting((prev) =>
            prev && prev.id === updated.id
              ? { ...prev, ...updated }
              : prev
          );
          setSightings((prev) =>
            prev.map((s) =>
              s.id === updated.id
                ? { ...s, ...updated, previewUrl: s.previewUrl }
                : s
            )
          );
        }}
      />
    </section>
  );
}
