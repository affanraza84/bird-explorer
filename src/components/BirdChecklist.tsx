"use client";

import { useState, useEffect, useMemo } from "react";
import { BIRD_CHECKLIST } from "@/data/bird-checklist";
import { BirdChecklistEntry, ChecklistObservationRecord } from "@/types/checklist";
import { Habitat, BirdSighting } from "@/types/bird";
import {
  getChecklistHistory,
  recordChecklistSighting,
} from "@/lib/bird-journal";
import { searchChecklist, filterChecklistByHabitat } from "@/lib/checklist-utils";
import { ManualFieldObservationModal } from "./ManualFieldObservationModal";

interface BirdChecklistProps {
  onFieldObservationSaved?: (sighting: BirdSighting, entry: BirdChecklistEntry) => void;
  refreshTrigger?: number;
}

const HABITAT_FILTERS: { id: Habitat | "all"; label: string; icon: string }[] = [
  { id: "all", label: "All Habitats", icon: "🌐" },
  { id: "garden", label: "Garden", icon: "🏡" },
  { id: "urban", label: "Urban", icon: "🏙️" },
  { id: "woodland", label: "Woodland", icon: "🌲" },
  { id: "wetland", label: "Wetland", icon: "💧" },
  { id: "grassland", label: "Grassland", icon: "🌾" },
  { id: "farmland", label: "Farmland", icon: "🚜" },
  { id: "coastal", label: "Coastal", icon: "🌊" },
];

export function BirdChecklist({
  onFieldObservationSaved,
  refreshTrigger = 0,
}: BirdChecklistProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHabitat, setSelectedHabitat] = useState<Habitat | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "observed" | "unobserved">("all");

  const [historyRecords, setHistoryRecords] = useState<Record<string, ChecklistObservationRecord>>({});
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [selectedEntryForObservation, setSelectedEntryForObservation] = useState<BirdChecklistEntry | null>(null);

  // Load checklist observation history from IndexedDB
  useEffect(() => {
    let isMounted = true;
    async function loadHistory() {
      try {
        const records = await getChecklistHistory();
        if (isMounted) {
          const map: Record<string, ChecklistObservationRecord> = {};
          records.forEach((r) => {
            map[r.speciesId] = r;
          });
          setHistoryRecords(map);
        }
      } catch (err) {
        console.error("Failed to load checklist history:", err);
      }
    }
    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  // Handle direct "Mark Observed" action
  const handleMarkObserved = async (entry: BirdChecklistEntry) => {
    if (markingId) return;
    setMarkingId(entry.id);

    try {
      const updatedRecord = await recordChecklistSighting(entry.id);
      setHistoryRecords((prev) => ({
        ...prev,
        [entry.id]: updatedRecord,
      }));
    } catch (err) {
      console.error("Failed to mark checklist observation:", err);
    } finally {
      setMarkingId(null);
    }
  };

  // Filter and search entries
  const filteredEntries = useMemo(() => {
    let result = BIRD_CHECKLIST;

    if (selectedHabitat !== "all") {
      result = filterChecklistByHabitat(selectedHabitat, result);
    }

    if (searchQuery.trim()) {
      result = searchChecklist(searchQuery, result);
    }

    if (statusFilter === "observed") {
      result = result.filter((e) => !!historyRecords[e.id]);
    } else if (statusFilter === "unobserved") {
      result = result.filter((e) => !historyRecords[e.id]);
    }

    return result;
  }, [searchQuery, selectedHabitat, statusFilter, historyRecords]);

  // Statistics
  const totalCount = BIRD_CHECKLIST.length;
  const observedCount = useMemo(() => {
    return BIRD_CHECKLIST.filter((e) => !!historyRecords[e.id]).length;
  }, [historyRecords]);
  const unobservedCount = totalCount - observedCount;

  const formatLastObserved = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Recently";
    }
  };

  return (
    <section className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Offline Bird Checklist
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
              Regional Field Reference
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Pre-bundled field guide for Jharkhand &amp; Central India • 100% offline &bull; No API or data usage
          </p>
        </div>

        {/* Counters summary */}
        <div className="flex items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-1.5">
            <span className="text-zinc-400">Total:</span>
            <span className="font-bold text-zinc-800 dark:text-zinc-200">{totalCount}</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
            <span>✓ Observed:</span>
            <span className="font-bold">{observedCount}</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
            <span>Remaining:</span>
            <span className="font-bold">{unobservedCount}</span>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by common name, scientific name, or family..."
              className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
            />
            <svg
              className="w-4 h-4 text-zinc-400 absolute left-3 top-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Segmented Buttons */}
          <div className="inline-flex rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-1 text-xs font-medium shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === "all"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("observed")}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === "observed"
                  ? "bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Observed ({observedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("unobserved")}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === "unobserved"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Unseen ({unobservedCount})
            </button>
          </div>
        </div>

        {/* Habitat Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {HABITAT_FILTERS.map((h) => {
            const isSelected = selectedHabitat === h.id;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => setSelectedHabitat(h.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
                }`}
              >
                <span>{h.icon}</span>
                <span>{h.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Checklist Species List */}
      {filteredEntries.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-3">
          <p className="text-3xl">🌿</p>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            No checklist species match your filter
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Try adjusting your search terms or selecting &quot;All Habitats&quot;.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedHabitat("all");
              setStatusFilter("all");
            }}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {filteredEntries.map((entry) => {
            const record = historyRecords[entry.id];
            const isObserved = !!record;
            const isMarking = markingId === entry.id;

            return (
              <div
                key={entry.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  isObserved
                    ? "bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 shadow-xs"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                {/* Header & Bird Names */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {isObserved ? "✅" : "▫️"}
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight leading-snug">
                          {entry.commonName}
                        </h3>
                        {entry.scientificName && (
                          <p className="text-xs italic text-zinc-500 dark:text-zinc-400">
                            {entry.scientificName}
                            {entry.family && (
                              <span className="not-italic text-zinc-400 font-normal"> &bull; {entry.family}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {isObserved && (
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                          {record.observationCount > 1
                            ? `${record.observationCount}× seen`
                            : "Observed"}
                        </span>
                        <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                          {formatLastObserved(record.lastObservedAt)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Habitats */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {entry.habitats.map((h) => (
                      <span
                        key={h}
                        className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 capitalize"
                      >
                        {h}
                      </span>
                    ))}
                  </div>

                  {/* Description */}
                  {entry.description && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed pt-1 line-clamp-2">
                      {entry.description}
                    </p>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  {/* Mark Observed quick button */}
                  <button
                    type="button"
                    onClick={() => handleMarkObserved(entry)}
                    disabled={isMarking}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                      isObserved
                        ? "bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200/80"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                    }`}
                  >
                    {isMarking ? (
                      <span>Saving...</span>
                    ) : isObserved ? (
                      <>
                        <span>✓</span>
                        <span>Mark Again</span>
                      </>
                    ) : (
                      <>
                        <span>+</span>
                        <span>Mark Observed</span>
                      </>
                    )}
                  </button>

                  {/* Add Field Observation (with metadata/notes to journal) */}
                  <button
                    type="button"
                    onClick={() => setSelectedEntryForObservation(entry)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <span>🔭</span>
                    <span>Log Field Note</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Field Observation Modal for Checklist Entry */}
      <ManualFieldObservationModal
        entry={selectedEntryForObservation}
        onClose={() => setSelectedEntryForObservation(null)}
        onObservationSaved={(sighting, checklistEntry) => {
          // Update checklist history count locally
          getChecklistHistory().then((records) => {
            const map: Record<string, ChecklistObservationRecord> = {};
            records.forEach((r) => {
              map[r.speciesId] = r;
            });
            setHistoryRecords(map);
          });

          if (onFieldObservationSaved) {
            onFieldObservationSaved(sighting, checklistEntry);
          }
        }}
      />
    </section>
  );
}
