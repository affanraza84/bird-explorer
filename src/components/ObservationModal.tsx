"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Image from "next/image";
import { BirdSighting, Habitat, WeatherCondition, ObservationTag } from "@/types/bird";
import {
  attachAudioToSighting,
  removeAudioFromSighting,
  updateSightingMetadata,
} from "@/lib/bird-journal";
import { AudioRecorder } from "@/components/AudioRecorder";
import {
  ObservationMetadataSelector,
  HABITAT_OPTIONS,
  WEATHER_OPTIONS,
  TAG_OPTIONS,
} from "./ObservationMetadataSelector";

interface ObservationModalProps {
  sighting: (BirdSighting & { previewUrl?: string }) | null;
  onClose: () => void;
  onSightingUpdated?: (updated: BirdSighting) => void;
}

export function ObservationModal({
  sighting,
  onClose,
  onSightingUpdated,
}: ObservationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Audio state
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [isSavingAudio, setIsSavingAudio] = useState(false);
  const [isConfirmingDeleteAudio, setIsConfirmingDeleteAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Metadata editing state
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editHabitat, setEditHabitat] = useState<Habitat | undefined>(sighting?.habitat);
  const [editWeather, setEditWeather] = useState<WeatherCondition | undefined>(sighting?.weatherCondition);
  const [editTags, setEditTags] = useState<ObservationTag[]>(sighting?.tags || []);
  const [editNotes, setEditNotes] = useState<string>(sighting?.description || "");
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const handleStartEdit = () => {
    setEditHabitat(sighting?.habitat);
    setEditWeather(sighting?.weatherCondition);
    setEditTags(sighting?.tags || []);
    setEditNotes(sighting?.description || "");
    setMetadataError(null);
    setIsEditingMetadata(true);
  };

  // Manage audio object URL safely via useMemo + effect cleanup
  const audioBlob = sighting?.audio;
  const audioUrl = useMemo(() => {
    if (audioBlob instanceof Blob) {
      try {
        return URL.createObjectURL(audioBlob);
      } catch (err) {
        console.error("Failed to create audio URL:", err);
        return null;
      }
    }
    return null;
  }, [audioBlob]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        try {
          URL.revokeObjectURL(audioUrl);
        } catch {
          // Ignore
        }
      }
    };
  }, [audioUrl]);

  // Close on Escape key and prevent background scroll
  useEffect(() => {
    if (!sighting) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isEditingMetadata) {
          setIsEditingMetadata(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus close button on open for keyboard accessibility
    closeButtonRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [sighting, onClose, isEditingMetadata]);

  if (!sighting) return null;

  const formatDate = (timestamp: number) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "full",
        timeStyle: "medium",
      }).format(new Date(timestamp));
    } catch {
      return new Date(timestamp).toLocaleString();
    }
  };

  const handleSaveAudio = async (
    blob: Blob,
    mimeType: string,
    durationMs: number
  ) => {
    setIsSavingAudio(true);
    setAudioError(null);

    try {
      const updated = await attachAudioToSighting(
        sighting.id,
        blob,
        durationMs,
        mimeType
      );

      setIsRecordingMode(false);

      if (onSightingUpdated) {
        onSightingUpdated(updated);
      }
    } catch (err: unknown) {
      setAudioError(
        err instanceof Error
          ? err.message
          : "Failed to attach audio note to sighting."
      );
    } finally {
      setIsSavingAudio(false);
    }
  };

  const handleDeleteAudio = async () => {
    setAudioError(null);

    try {
      const updated = await removeAudioFromSighting(sighting.id);
      setIsConfirmingDeleteAudio(false);

      if (onSightingUpdated) {
        onSightingUpdated(updated);
      }
    } catch (err: unknown) {
      setAudioError(
        err instanceof Error
          ? err.message
          : "Failed to delete audio note from sighting."
      );
    }
  };

  const handleSaveMetadataChanges = async () => {
    setIsSavingMetadata(true);
    setMetadataError(null);

    try {
      const updated = await updateSightingMetadata(sighting.id, {
        habitat: editHabitat,
        weatherCondition: editWeather,
        tags: editTags,
        description: editNotes,
      });

      setIsEditingMetadata(false);

      if (onSightingUpdated) {
        onSightingUpdated(updated);
      }
    } catch (err: unknown) {
      setMetadataError(
        err instanceof Error
          ? err.message
          : "Failed to update observation metadata."
      );
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleCancelEdit = () => {
    setEditHabitat(sighting.habitat);
    setEditWeather(sighting.weatherCondition);
    setEditTags(sighting.tags || []);
    setEditNotes(sighting.description || "");
    setIsEditingMetadata(false);
    setMetadataError(null);
  };

  const durationSec =
    typeof sighting.audioDurationMs === "number"
      ? Math.round(sighting.audioDurationMs / 1000)
      : null;

  // Metadata label lookups
  const habitatObj = HABITAT_OPTIONS.find((h) => h.id === sighting.habitat);
  const weatherObj = WEATHER_OPTIONS.find((w) => w.id === sighting.weatherCondition);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="observation-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-10 my-8 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Top Header with Close Button */}
        <div className="absolute top-3 right-3 z-20">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close observation details"
            className="w-9 h-9 rounded-full bg-zinc-950/70 hover:bg-zinc-950 text-white flex items-center justify-center transition-colors cursor-pointer border border-white/20 backdrop-blur-md shadow-md"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto">
          {/* Bird Photo or Photo-less Field Observation Placeholder */}
          {sighting.previewUrl ? (
            <div className="relative w-full h-72 sm:h-96 bg-zinc-950 flex items-center justify-center overflow-hidden border-b border-zinc-100 dark:border-zinc-800">
              <Image
                src={sighting.previewUrl}
                alt={sighting.species}
                fill
                className="object-contain"
                unoptimized
                priority
              />
            </div>
          ) : (
            <div className="w-full py-10 px-6 bg-gradient-to-br from-emerald-950/30 via-zinc-900 to-zinc-950 border-b border-zinc-800 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-3xl mb-3 shadow-inner">
                🔭
              </div>
              <p className="text-sm font-semibold text-emerald-400">
                Direct Field Observation
              </p>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                Recorded outdoors without photo attachment. Verified via offline field checklist.
              </p>
            </div>
          )}

          {/* Details Body */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Header / Species & Confidence */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80">
                  Confidence: {sighting.confidence}
                </span>

                <time
                  dateTime={new Date(sighting.createdAt).toISOString()}
                  className="text-xs font-mono text-zinc-500 dark:text-zinc-400"
                >
                  {formatDate(sighting.createdAt)}
                </time>
              </div>

              <h2
                id="observation-modal-title"
                className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50"
              >
                {sighting.species}
              </h2>
            </div>

            {/* Field Observation Metadata Section */}
            <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <span>🌿</span>
                  <span>Observation Metadata &amp; Habitat</span>
                </h3>

                {!isEditingMetadata && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                    <span>Edit Observation</span>
                  </button>
                )}
              </div>

              {metadataError && (
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-800 dark:text-red-300">
                  {metadataError}
                </div>
              )}

              {/* READ-ONLY VIEW */}
              {!isEditingMetadata ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Habitat */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                      Habitat
                    </p>
                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {habitatObj ? (
                        <>
                          <span>{habitatObj.icon}</span>
                          <span>{habitatObj.label}</span>
                        </>
                      ) : (
                        <span className="text-zinc-400 italic text-xs">Not specified</span>
                      )}
                    </div>
                  </div>

                  {/* Conditions */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                      Weather Condition
                    </p>
                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {weatherObj ? (
                        <>
                          <span>{weatherObj.icon}</span>
                          <span>{weatherObj.label}</span>
                        </>
                      ) : (
                        <span className="text-zinc-400 italic text-xs">Not specified</span>
                      )}
                    </div>
                  </div>

                  {/* Behavior / Tags */}
                  <div className="sm:col-span-2 space-y-1.5 pt-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                      Behavior &amp; Activity
                    </p>
                    {sighting.tags && sighting.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {sighting.tags.map((tag) => {
                          const tagObj = TAG_OPTIONS.find((t) => t.id === tag);
                          return (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                            >
                              <span>{tagObj?.icon || "✓"}</span>
                              <span className="capitalize">{tagObj?.label || tag}</span>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-zinc-400 italic text-xs">No behavior tags recorded</p>
                    )}
                  </div>
                </div>
              ) : (
                /* EDITING VIEW */
                <div className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <ObservationMetadataSelector
                    selectedHabitat={editHabitat}
                    onHabitatChange={setEditHabitat}
                    selectedWeather={editWeather}
                    onWeatherChange={setEditWeather}
                    selectedTags={editTags}
                    onTagsChange={setEditTags}
                    disabled={isSavingMetadata}
                  />

                  {/* Edit notes */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Field Notes
                    </label>
                    <textarea
                      rows={3}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      disabled={isSavingMetadata}
                      placeholder="Add observation notes..."
                      className="w-full text-sm p-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isSavingMetadata}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveMetadataChanges}
                      disabled={isSavingMetadata}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-sm"
                    >
                      {isSavingMetadata ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Complete Field Description */}
            {!isEditingMetadata && (
              <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/80 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Observation Notes &amp; Field Marks
                </h3>
                <p className="text-sm sm:text-base leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                  {sighting.description || "No field notes recorded."}
                </p>
              </div>
            )}

            {/* Audio Field Note Section */}
            <div className="p-5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎙️</span>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                    Audio Field Note
                  </h3>
                </div>

                {durationSec !== null && !isRecordingMode && (
                  <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300 font-medium">
                    {durationSec} sec clip
                  </span>
                )}
              </div>

              {audioError && (
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-800 dark:text-red-300">
                  {audioError}
                </div>
              )}

              {/* Active Audio Playback View */}
              {audioUrl && !isRecordingMode && (
                <div className="space-y-3 pt-1">
                  <audio
                    controls
                    src={audioUrl}
                    className="w-full h-10 accent-emerald-600 dark:accent-emerald-400"
                  />

                  {/* Audio Actions: Replace or Delete */}
                  {!isConfirmingDeleteAudio ? (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-100 dark:border-emerald-900/40">
                      <button
                        type="button"
                        onClick={() => setIsRecordingMode(true)}
                        className="text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer font-medium"
                      >
                        Replace Audio
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsConfirmingDeleteAudio(true)}
                        className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                      >
                        Delete Audio Note
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center justify-between gap-3 text-xs text-red-900 dark:text-red-200">
                      <span>Delete this audio recording?</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsConfirmingDeleteAudio(false)}
                          className="px-2.5 py-1 rounded bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteAudio}
                          className="px-2.5 py-1 rounded bg-red-600 text-white font-medium cursor-pointer"
                        >
                          Confirm Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* No Audio Present - Offer Record Action */}
              {!audioUrl && !isRecordingMode && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    No bird audio note attached yet. Record a call or song up to 60 seconds.
                  </p>

                  <button
                    type="button"
                    onClick={() => setIsRecordingMode(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs shrink-0"
                  >
                    <span>+ Record Audio Note</span>
                  </button>
                </div>
              )}

              {/* Inline Recording Component */}
              {isRecordingMode && (
                <div className="pt-1">
                  <AudioRecorder
                    onSaveAudio={handleSaveAudio}
                    onCancel={() => setIsRecordingMode(false)}
                    isSaving={isSavingAudio}
                  />
                </div>
              )}
            </div>

            {/* Local Metadata Footer */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Stored offline in local IndexedDB</span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 cursor-pointer transition-colors"
              >
                Close Observation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
