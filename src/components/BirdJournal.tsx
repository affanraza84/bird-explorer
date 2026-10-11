"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { BirdSighting } from "@/types/bird";
import {
  getSightings,
  deleteSighting,
  clearSightings,
  isIndexedDBAvailable,
} from "@/lib/bird-journal";

interface BirdJournalProps {
  refreshTrigger?: number;
}

interface SightingWithPreview extends BirdSighting {
  previewUrl: string;
}

export function BirdJournal({ refreshTrigger = 0 }: BirdJournalProps) {
  const [sightings, setSightings] = useState<SightingWithPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Keep track of active object URLs for cleanup on unmount
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
            try {
              previewUrl = URL.createObjectURL(sighting.image);
              activeUrlsRef.current.add(previewUrl);
            } catch (err) {
              console.error("Failed to create preview URL:", err);
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

        {sightings.length > 0 && !isConfirmingClear && (
          <button
            type="button"
            onClick={() => setIsConfirmingClear(true)}
            className="self-start sm:self-auto text-xs text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 font-medium transition-colors cursor-pointer px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-900/50"
          >
            Clear Journal
          </button>
        )}
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

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400 dark:text-zinc-500">
          <svg className="animate-spin h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">Loading your local bird journal…</span>
        </div>
      ) : sightings.length === 0 ? (
        /* Empty State */
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
              No bird sightings recorded yet
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mt-1">
              Upload and identify a bird photo above, then click &ldquo;Save to Journal&rdquo; to build your offline naturalist log.
            </p>
          </div>
        </div>
      ) : (
        /* Sightings Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sightings.map((sighting) => {
            const isDeletingThis = deletingId === sighting.id;

            return (
              <article
                key={sighting.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-md shadow-zinc-950/5 overflow-hidden flex flex-col justify-between transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                <div>
                  {/* Photo Thumbnail */}
                  <div className="relative w-full h-48 bg-zinc-950 flex items-center justify-center overflow-hidden border-b border-zinc-100 dark:border-zinc-800">
                    {sighting.previewUrl ? (
                      <Image
                        src={sighting.previewUrl}
                        alt={sighting.species}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="text-xs text-zinc-500">Loading photo…</div>
                    )}

                    <span className="absolute top-2.5 right-2.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-900/80 backdrop-blur-sm text-zinc-200 border border-zinc-700/60">
                      {sighting.confidence}
                    </span>
                  </div>

                  {/* Body Info */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <time
                        dateTime={new Date(sighting.createdAt).toISOString()}
                        className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500"
                      >
                        {formatDate(sighting.createdAt)}
                      </time>
                    </div>

                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight leading-snug">
                      {sighting.species}
                    </h3>

                    <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 line-clamp-3">
                      {sighting.description}
                    </p>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="px-4 py-3 bg-zinc-50/70 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    IndexedDB
                  </span>

                  <button
                    type="button"
                    onClick={() => handleDelete(sighting)}
                    disabled={isDeletingThis}
                    className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                    title="Delete sighting"
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
    </section>
  );
}
