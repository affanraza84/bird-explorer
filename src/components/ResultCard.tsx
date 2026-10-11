"use client";

import { useState } from "react";
import { BirdIdentification, BirdSighting } from "@/types/bird";
import { saveSighting } from "@/lib/bird-journal";

interface ResultCardProps {
  result: BirdIdentification;
  imageFile: File | null;
  onReset: () => void;
  onSightingSaved?: (sighting: BirdSighting) => void;
}

export function ResultCard({
  result,
  imageFile,
  onReset,
  onSightingSaved,
}: ResultCardProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isUncertain =
    result.confidence.toLowerCase().includes("uncertain") ||
    result.species.toLowerCase().includes("unable") ||
    result.species.toLowerCase().includes("unknown");

  const handleSaveToJournal = async () => {
    if (!imageFile || isSaving || isSaved) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const savedEntry = await saveSighting({
        species: result.species,
        confidence: result.confidence,
        description: result.description,
        image: imageFile,
      });

      setIsSaved(true);
      if (onSightingSaved) {
        onSightingSaved(savedEntry);
      }
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Failed to save sighting to local journal."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-950/5 overflow-hidden transition-all duration-300">
      {/* Top Banner */}
      <div
        className={`px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b ${
          isUncertain
            ? "bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200"
            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{isUncertain ? "⚠️" : "🕊️"}</span>
          <span className="text-sm font-semibold tracking-wide uppercase">
            {isUncertain ? "Uncertain Identification" : "Bird identified successfully."}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              isUncertain
                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
            }`}
          >
            Confidence: {result.confidence}
          </span>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-6 sm:p-8 space-y-6">
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-zinc-400 dark:text-zinc-500 mb-1">
            Identified Bird
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
            {result.species}
          </h2>
        </div>

        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/80">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
            Field Notes &amp; Observable Characteristics
          </p>
          <p className="text-sm sm:text-base leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
            {result.description}
          </p>
        </div>

        {/* Save to Journal Action Section */}
        <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {isSaved ? "Saved to your Bird Journal." : "Record this sighting"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {isSaved
                ? "This sighting is stored locally in your browser's IndexedDB."
                : "Preserve this bird photo and identification in your offline field journal."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveToJournal}
            disabled={!imageFile || isSaving || isSaved}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer shadow-sm ${
              isSaved
                ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 cursor-default"
                : isSaving
                ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-[0.98]"
            }`}
          >
            {isSaved ? (
              <>
                <svg
                  className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Saved to your Bird Journal.</span>
              </>
            ) : isSaving ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-zinc-400"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span>Saving to Journal...</span>
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <span>Save to Journal</span>
              </>
            )}
          </button>
        </div>

        {saveError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
            {saveError}
          </div>
        )}

        {/* Local AI Provenance Footer */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Processed locally with Ollama (Qwen2.5-VL)</span>
          </div>

          <button
            onClick={onReset}
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Identify Another Bird
          </button>
        </div>
      </div>
    </div>
  );
}
