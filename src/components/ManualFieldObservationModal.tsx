"use client";

import { useState } from "react";
import { BirdChecklistEntry } from "@/types/checklist";
import { BirdSighting, Habitat, WeatherCondition, ObservationTag } from "@/types/bird";
import { saveSighting, recordChecklistSighting } from "@/lib/bird-journal";
import { ObservationMetadataSelector } from "./ObservationMetadataSelector";

interface ManualFieldObservationModalProps {
  entry: BirdChecklistEntry | null;
  onClose: () => void;
  onObservationSaved: (sighting: BirdSighting, checklistEntry: BirdChecklistEntry) => void;
}

export function ManualFieldObservationModal({
  entry,
  onClose,
  onObservationSaved,
}: ManualFieldObservationModalProps) {
  const [habitat, setHabitat] = useState<Habitat | undefined>(
    entry?.habitats && entry.habitats.length > 0 ? entry.habitats[0] : undefined
  );
  const [weatherCondition, setWeatherCondition] = useState<WeatherCondition | undefined>(undefined);
  const [tags, setTags] = useState<ObservationTag[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!entry) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);

    try {
      // 1. Record in checklist history
      await recordChecklistSighting(entry.id);

      // 2. Save image-less field observation into local journal
      const sighting = await saveSighting({
        species: entry.commonName,
        confidence: "Field Observation",
        description:
          notes.trim() ||
          `Direct field observation of ${entry.commonName}${
            entry.scientificName ? ` (${entry.scientificName})` : ""
          }.`,
        habitat,
        weatherCondition,
        tags,
      });

      onObservationSaved(sighting, entry);
      onClose();
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to record field observation."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="field-observation-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-10 my-8 p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🔭</span>
              <span className="text-xs font-semibold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
                Manual Field Observation
              </span>
            </div>
            <h2
              id="field-observation-modal-title"
              className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight"
            >
              {entry.commonName}
            </h2>
            {entry.scientificName && (
              <p className="text-xs italic text-zinc-500 dark:text-zinc-400">
                {entry.scientificName}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close form"
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-xs text-emerald-800 dark:text-emerald-300">
          ✓ No photo required. This sighting will be saved to your offline Bird Journal and marked in your checklist history.
        </div>

        {saveError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-800 dark:text-red-300">
            {saveError}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Metadata Selector */}
          <ObservationMetadataSelector
            selectedHabitat={habitat}
            onHabitatChange={setHabitat}
            selectedWeather={weatherCondition}
            onWeatherChange={setWeatherCondition}
            selectedTags={tags}
            onTagsChange={setTags}
            disabled={isSaving}
          />

          {/* Field Notes */}
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Field Notes <span className="text-[10px] lowercase text-zinc-400">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSaving}
              placeholder="e.g. Saw single individual foraging in canopy near pond edge..."
              className="w-full text-sm p-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-zinc-400"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Field Observation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
