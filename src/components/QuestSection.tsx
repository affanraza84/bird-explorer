"use client";

import { useEffect, useState, useRef } from "react";
import { Quest, QuestDuration, QuestProgress, LocationTrackingStatus } from "@/types/quest";
import {
  clearActiveQuest,
  saveActiveQuest,
  toggleTaskCompletion,
  updateQuestDistance,
  updateQuestLocationStatus,
} from "@/lib/quest-storage";
import {
  getCurrentLocation,
  startLocationTracking,
  isGeolocationSupported,
} from "@/lib/geolocation";

interface QuestSectionProps {
  activeQuest: Quest | null;
  questProgress: QuestProgress | null;
  onQuestStarted: (quest: Quest, progress: QuestProgress) => void;
  onQuestUpdated: (progress: QuestProgress) => void;
  onQuestReset: () => void;
  lastIdentifiedSpeciesNotice?: string | null;
}

export function QuestSection({
  activeQuest,
  questProgress,
  onQuestStarted,
  onQuestUpdated,
  onQuestReset,
  lastIdentifiedSpeciesNotice,
}: QuestSectionProps) {
  const [selectedDuration, setSelectedDuration] = useState<QuestDuration>(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);

  // Keep ref to latest props to prevent stale closures in watcher callbacks
  const activeQuestRef = useRef(activeQuest);
  const questProgressRef = useRef(questProgress);
  const onQuestUpdatedRef = useRef(onQuestUpdated);

  useEffect(() => {
    activeQuestRef.current = activeQuest;
    questProgressRef.current = questProgress;
    onQuestUpdatedRef.current = onQuestUpdated;
  });

  const activeQuestId = activeQuest?.id;
  const isQuestCompleted = questProgress?.isCompleted;

  // Active GPS watcher lifecycle: runs once per active quest and cleans up on completion or unmount
  useEffect(() => {
    if (!activeQuestId || isQuestCompleted) {
      return;
    }

    const initialDistance = questProgressRef.current?.distanceWalkedMeters || 0;

    const cleanup = startLocationTracking({
      initialAccumulatedMeters: initialDistance,
      onMovement: (_segmentMeters, totalAccumulated) => {
        const currentQuest = activeQuestRef.current;
        const currentProgress = questProgressRef.current;
        if (!currentQuest || !currentProgress) return;

        const updated = updateQuestDistance(
          totalAccumulated,
          "tracking",
          currentQuest,
          currentProgress
        );
        onQuestUpdatedRef.current(updated);
      },
      onStatusChange: (status, message) => {
        const currentQuest = activeQuestRef.current;
        const currentProgress = questProgressRef.current;
        if (message) setGpsNotice(message);
        if (!currentQuest || !currentProgress) return;

        const updated = updateQuestLocationStatus(
          status,
          currentQuest,
          currentProgress
        );
        onQuestUpdatedRef.current(updated);
      },
    });

    return () => {
      cleanup();
    };
  }, [activeQuestId, isQuestCompleted]);

  const handleStartQuest = async (duration: QuestDuration) => {
    setIsGenerating(true);
    setErrorMessage(null);
    setGpsNotice(null);

    try {
      // 1. Generate quest via Next.js backend API (Ollama)
      const response = await fetch("/api/generate-quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes: duration }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not generate a quest. Please try again."
        );
      }

      const newQuest: Quest = {
        ...data.quest,
        source: data.generationSource || data.quest.source,
        sourceNotice: data.message || data.quest.sourceNotice,
      };

      // 2. Request browser location permission & capture initial position
      let initialStatus: LocationTrackingStatus = "idle";

      if (!isGeolocationSupported()) {
        initialStatus = "unsupported";
        setGpsNotice("Browser geolocation is not supported on this device.");
      } else {
        try {
          await getCurrentLocation();
          initialStatus = "tracking";
        } catch {
          initialStatus = "denied";
          setGpsNotice(
            "Location tracking is unavailable. Outdoor distance cannot be verified."
          );
        }
      }

      const initialProgress: QuestProgress = {
        questId: newQuest.id,
        discoveredSpecies: [],
        photosCaptured: 0,
        completedTaskIds: [],
        distanceWalkedMeters: 0,
        locationStatus: initialStatus,
        isCompleted: false,
      };

      saveActiveQuest(newQuest, initialProgress);
      onQuestStarted(newQuest, initialProgress);
    } catch (err: unknown) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setErrorMessage(
          "Quest generation requires the local AI service and is unavailable offline. Your existing quest and offline journal remain available."
        );
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Local AI could not generate a quest. Make sure Ollama is running."
        );
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleTask = (taskId: string) => {
    if (!activeQuest || !questProgress) return;
    const updated = toggleTaskCompletion(taskId, activeQuest, questProgress);
    onQuestUpdated(updated);
  };

  const handleAbandonQuest = () => {
    clearActiveQuest();
    onQuestReset();
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  // State 1: Completed Quest Screen
  if (activeQuest && questProgress && questProgress.isCompleted) {
    const isGpsVerified =
      questProgress.locationStatus === "tracking" &&
      questProgress.distanceWalkedMeters >= (activeQuest.distanceTargetMeters || 0);

    return (
      <section className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/40 dark:via-zinc-900/60 dark:to-zinc-900/40 p-6 sm:p-8 space-y-6 shadow-xl shadow-emerald-950/5">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 text-3xl shadow-inner">
            🎉
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Quest Complete!
          </h2>
          <p className="text-sm sm:text-base font-medium text-emerald-800 dark:text-emerald-300">
            You completed today&apos;s Bird Quest.
          </p>
          <div className="inline-block px-4 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 text-xs font-semibold uppercase tracking-wider">
            You touched grass today. 🌿
          </div>
        </div>

        {/* Real Quest Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
            <span className="text-2xl">🐦</span>
            <div className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              {questProgress.discoveredSpecies.length}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Unique Species
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
            <span className="text-2xl">📸</span>
            <div className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              {questProgress.photosCaptured}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Photos Taken
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
            <span className="text-2xl">📍</span>
            <div className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              {formatDistance(questProgress.distanceWalkedMeters)}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Distance Walked
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
            <span className="text-2xl">⏱</span>
            <div className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              {activeQuest.durationMinutes} min
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Duration
            </div>
          </div>
        </div>

        {/* Outdoor Movement Verification Banner */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs flex items-center justify-between gap-3">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Outdoor Movement Verification:
          </span>
          {isGpsVerified ? (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1">
              <span>✓</span> Verified ({formatDistance(questProgress.distanceWalkedMeters)})
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-semibold">
              Distance unverified (GPS unavailable)
            </span>
          )}
        </div>

        {/* Discovered Species List */}
        {questProgress.discoveredSpecies.length > 0 && (
          <div className="p-4 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Species Documented During This Mission:
            </p>
            <div className="flex flex-wrap gap-2">
              {questProgress.discoveredSpecies.map((species, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                >
                  ✓ {species}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={handleAbandonQuest}
            className="px-6 py-2.5 rounded-xl font-medium text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            Start a New Quest
          </button>
        </div>
      </section>
    );
  }

  // State 2: Active Quest Screen
  if (activeQuest && questProgress) {
    const discoveredCount = questProgress.discoveredSpecies.length;
    const targetBirds = activeQuest.targetBirds;
    const birdsPercent = Math.min(
      100,
      Math.round((discoveredCount / targetBirds) * 100)
    );

    const distanceWalked = questProgress.distanceWalkedMeters || 0;
    const targetDistance = activeQuest.distanceTargetMeters || 1000;
    const distancePercent = Math.min(
      100,
      Math.round((distanceWalked / targetDistance) * 100)
    );

    const isTracking = questProgress.locationStatus === "tracking";
    const isDenied = questProgress.locationStatus === "denied";

    return (
      <section className="rounded-2xl border border-emerald-300 dark:border-emerald-800/80 bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-950/5 p-6 sm:p-8 space-y-6">
        {/* Header & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                Active Mission • {activeQuest.durationMinutes} min
              </span>

              {activeQuest.source === "builtin" ? (
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                  Built-in Quest
                </span>
              ) : (
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
                  AI-Generated
                </span>
              )}

              {/* GPS Status Pill */}
              <span
                className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border ${
                  isTracking
                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/70"
                    : isDenied
                    ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800/70"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isTracking
                      ? "bg-emerald-500 animate-pulse"
                      : isDenied
                      ? "bg-amber-500"
                      : "bg-zinc-400"
                  }`}
                />
                {isTracking
                  ? "🟢 GPS Tracking"
                  : isDenied
                  ? "🟡 Location Unavailable"
                  : "⚪ GPS Initializing"}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
              {activeQuest.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleAbandonQuest}
            className="self-start sm:self-auto text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
          >
            End / Change Quest
          </button>
        </div>

        {/* Built-in quest subtle notice */}
        {activeQuest.source === "builtin" && (
          <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <span className="text-base shrink-0 mt-0.5">ℹ️</span>
            <div className="leading-relaxed">
              <p className="font-semibold mb-0.5">Using Built-in Quest</p>
              <p className="text-amber-800/90 dark:text-amber-300/90">
                {activeQuest.sourceNotice || "Using a built-in quest because local AI is unavailable."} All outdoor tracking, photography tasks, and GPS goals are fully functional.
              </p>
            </div>
          </div>
        )}

        {/* Touch Grass Philosophy Banner */}
        <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-start gap-3">
          <span className="text-xl shrink-0 mt-0.5">🌿</span>
          <div className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
            <p className="font-semibold text-emerald-900 dark:text-emerald-200 mb-0.5">
              Your mission is ready. Put your phone away and start exploring.
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">
              The screen should be the shortest part of your outdoor experience. Look up into the branches, walk the trail, and observe quietly. Only take your phone out when you spot a bird to photograph.
            </p>
          </div>
        </div>

        {/* Progress Grid: Bird Discoveries + Outdoor Movement */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 1. Bird Discoveries */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <span>🐦</span> Bird Discoveries
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {discoveredCount} / {targetBirds} species
              </span>
            </div>

            <div className="w-full h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${birdsPercent}%` }}
              />
            </div>

            {discoveredCount > 0 ? (
              <div className="pt-1 flex flex-wrap gap-1">
                {questProgress.discoveredSpecies.map((sp, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                  >
                    ✓ {sp}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-zinc-400">0 species documented so far</p>
            )}
          </div>

          {/* 2. Outdoor Movement */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <span>📍</span> Outdoor Progress
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {formatDistance(distanceWalked)} / {formatDistance(targetDistance)}
              </span>
            </div>

            <div className="w-full h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${distancePercent}%` }}
              />
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {isTracking
                ? `${distancePercent}% of movement goal • Coordinates kept strictly in memory`
                : "Location tracking unavailable • Distance verification optional"}
            </p>
          </div>
        </div>

        {/* Notices */}
        {gpsNotice && (
          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/40">
            {gpsNotice}
          </p>
        )}

        {lastIdentifiedSpeciesNotice && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
            {lastIdentifiedSpeciesNotice}
          </p>
        )}

        {/* Mission Tasks Checklist */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Mission Tasks
          </h3>

          <div className="space-y-2">
            {activeQuest.tasks.map((task) => {
              const isDone = questProgress.completedTaskIds.includes(task.id);

              return (
                <div
                  key={task.id}
                  onClick={() => handleToggleTask(task.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isDone
                      ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80 text-zinc-800 dark:text-zinc-200"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => {}} // controlled via parent container click
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 cursor-pointer"
                    />
                    <span
                      className={`text-sm ${
                        isDone
                          ? "line-through text-zinc-400 dark:text-zinc-500"
                          : "text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      {task.text}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 uppercase">
                    {task.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // State 3: Start Quest UI
  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-950/5 p-6 sm:p-8 space-y-6">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
          <span>🎯</span> Outdoor Mission
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Start a Bird Quest
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Start an outdoor mission, put your screen away to touch grass, and verify your outdoor movement.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          How much time do you have?
        </label>

        <div className="grid grid-cols-3 gap-3">
          {([15, 30, 60] as QuestDuration[]).map((duration) => {
            const distance = duration === 15 ? "500 m" : duration === 30 ? "1.0 km" : "2.0 km";

            return (
              <button
                key={duration}
                type="button"
                onClick={() => setSelectedDuration(duration)}
                disabled={isGenerating}
                className={`py-3 px-2 rounded-xl text-center transition-all border cursor-pointer ${
                  selectedDuration === duration
                    ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shadow-sm"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-zinc-50/50 dark:bg-zinc-900"
                }`}
              >
                <div className="text-sm font-semibold">{duration} min</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">~{distance} walk</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
        <span className="text-base">📍</span>
        <span>Location permission is requested on start to verify your outdoor walk. Coordinates remain on-device.</span>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={() => handleStartQuest(selectedDuration)}
          disabled={isGenerating}
          className="w-full sm:w-auto px-6 py-3 rounded-xl font-medium text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Preparing mission…</span>
            </>
          ) : (
            <>
              <span>🌿 Start {selectedDuration}-Minute Quest</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
}
