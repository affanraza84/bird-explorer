import { useSyncExternalStore } from "react";
import { Quest, QuestProgress, LocationTrackingStatus } from "@/types/quest";

const ACTIVE_QUEST_KEY = "bird_explorer_active_quest";

export interface StoredQuestState {
  quest: Quest;
  progress: QuestProgress;
}

/**
 * Normalizes species names so scientific suffixes or casing don't cause duplicate counts.
 * Example: "Northern Cardinal (Cardinalis cardinalis)" -> "northern cardinal"
 */
export function normalizeSpeciesName(species: string): string {
  if (!species) return "";
  const commonPart = species.split("(")[0].trim().toLowerCase();
  return commonPart || species.trim().toLowerCase();
}

/**
 * Initializes a clean QuestProgress object for a newly generated Quest.
 */
export function initializeQuestProgress(quest: Quest): QuestProgress {
  return {
    questId: quest.id,
    discoveredSpecies: [],
    photosCaptured: 0,
    completedTaskIds: [],
    distanceWalkedMeters: 0,
    locationStatus: "idle",
    isCompleted: false,
  };
}

/**
 * Loads the active quest and its progress from browser localStorage.
 */
export function loadActiveQuest(): StoredQuestState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ACTIVE_QUEST_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredQuestState;
    if (
      parsed &&
      parsed.quest &&
      typeof parsed.quest.id === "string" &&
      parsed.progress &&
      typeof parsed.progress.questId === "string"
    ) {
      return parsed;
    }
  } catch (err) {
    console.error("Failed to parse stored active quest:", err);
  }

  return null;
}

/**
 * Saves the active quest and its progress to browser localStorage.
 */
export function saveActiveQuest(
  quest: Quest,
  progress: QuestProgress
): void {
  if (typeof window === "undefined") return;

  try {
    const state: StoredQuestState = { quest, progress };
    window.localStorage.setItem(ACTIVE_QUEST_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event("bird-quest-change"));
  } catch (err) {
    console.error("Failed to save active quest state:", err);
  }
}

/**
 * Clears the active quest from localStorage.
 */
export function clearActiveQuest(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(ACTIVE_QUEST_KEY);
    window.dispatchEvent(new Event("bird-quest-change"));
  } catch (err) {
    console.error("Failed to clear active quest state:", err);
  }
}

let cachedRaw: string | null = null;
let cachedState: StoredQuestState | null = null;

function subscribeToQuest(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", callback);
  window.addEventListener("bird-quest-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("bird-quest-change", callback);
  };
}

function getQuestSnapshot(): StoredQuestState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ACTIVE_QUEST_KEY);
  if (raw === cachedRaw) return cachedState;
  cachedRaw = raw;
  if (!raw) {
    cachedState = null;
    return null;
  }
  try {
    cachedState = JSON.parse(raw) as StoredQuestState;
  } catch {
    cachedState = null;
  }
  return cachedState;
}

function getQuestServerSnapshot(): StoredQuestState | null {
  return null;
}

export function useActiveQuest(): StoredQuestState | null {
  return useSyncExternalStore(
    subscribeToQuest,
    getQuestSnapshot,
    getQuestServerSnapshot
  );
}

/**
 * Evaluates whether all requirements for quest completion are met.
 * If location tracking is active, the distance target must also be fulfilled.
 * If location permission is unavailable/denied, the user can still complete tasks manually.
 */
export function checkQuestCompletion(
  quest: Quest,
  progress: QuestProgress
): boolean {
  const birdsGoalMet = progress.discoveredSpecies.length >= quest.targetBirds;
  const allTasksMet = quest.tasks.every((task) =>
    progress.completedTaskIds.includes(task.id)
  );

  const isDistanceRequired =
    progress.locationStatus === "tracking" &&
    typeof quest.distanceTargetMeters === "number" &&
    quest.distanceTargetMeters > 0;

  const distanceGoalMet =
    !isDistanceRequired || progress.distanceWalkedMeters >= quest.distanceTargetMeters;

  return birdsGoalMet && allTasksMet && distanceGoalMet;
}

/**
 * Updates accumulated distance walked and recalculates quest completion status.
 */
export function updateQuestDistance(
  accumulatedMeters: number,
  status: LocationTrackingStatus,
  quest: Quest,
  progress: QuestProgress
): QuestProgress {
  const nextProgress: QuestProgress = {
    ...progress,
    distanceWalkedMeters: accumulatedMeters,
    locationStatus: status,
  };

  const isFullyCompleted = checkQuestCompletion(quest, nextProgress);
  if (isFullyCompleted) {
    nextProgress.isCompleted = true;
    nextProgress.completedAt = progress.completedAt ?? Date.now();
  }

  saveActiveQuest(quest, nextProgress);
  return nextProgress;
}

/**
 * Updates the location tracking status (e.g. denied, error, tracking) without mutating distance.
 */
export function updateQuestLocationStatus(
  status: LocationTrackingStatus,
  quest: Quest,
  progress: QuestProgress
): QuestProgress {
  const nextProgress: QuestProgress = {
    ...progress,
    locationStatus: status,
  };

  const isFullyCompleted = checkQuestCompletion(quest, nextProgress);
  if (isFullyCompleted) {
    nextProgress.isCompleted = true;
    nextProgress.completedAt = progress.completedAt ?? Date.now();
  }

  saveActiveQuest(quest, nextProgress);
  return nextProgress;
}

/**
 * Records a bird identification against the active quest.
 * Guarantees that duplicate species are NOT counted twice toward unique species goal.
 */
export function recordBirdDiscovery(
  species: string,
  quest: Quest,
  progress: QuestProgress
): { updatedProgress: QuestProgress; isNewSpecies: boolean } {
  // Reject non-identifications
  if (
    !species ||
    species.toLowerCase().includes("unable to confidently identify") ||
    species.toLowerCase().includes("unknown")
  ) {
    return { updatedProgress: progress, isNewSpecies: false };
  }

  const normalizedNew = normalizeSpeciesName(species);
  const existingNormalizedSet = new Set(
    progress.discoveredSpecies.map(normalizeSpeciesName)
  );

  const isNewSpecies = !existingNormalizedSet.has(normalizedNew);

  const updatedDiscoveredSpecies = isNewSpecies
    ? [...progress.discoveredSpecies, species]
    : progress.discoveredSpecies;

  const updatedPhotos = progress.photosCaptured + 1;

  // Auto-complete photo tasks and discovery tasks if goals reached
  const updatedCompletedTaskIds = new Set(progress.completedTaskIds);

  quest.tasks.forEach((task) => {
    if (task.type === "photo") {
      updatedCompletedTaskIds.add(task.id);
    }
    if (
      task.type === "discovery" &&
      updatedDiscoveredSpecies.length >= quest.targetBirds
    ) {
      updatedCompletedTaskIds.add(task.id);
    }
  });

  const nextProgress: QuestProgress = {
    ...progress,
    discoveredSpecies: updatedDiscoveredSpecies,
    photosCaptured: updatedPhotos,
    completedTaskIds: Array.from(updatedCompletedTaskIds),
    isCompleted: false,
  };

  const isFullyCompleted = checkQuestCompletion(quest, nextProgress);
  if (isFullyCompleted) {
    nextProgress.isCompleted = true;
    nextProgress.completedAt = progress.completedAt ?? Date.now();
  }

  saveActiveQuest(quest, nextProgress);

  return { updatedProgress: nextProgress, isNewSpecies };
}

/**
 * Toggles a manual task checkbox (e.g. quiet observation task).
 */
export function toggleTaskCompletion(
  taskId: string,
  quest: Quest,
  progress: QuestProgress
): QuestProgress {
  const completedSet = new Set(progress.completedTaskIds);

  if (completedSet.has(taskId)) {
    completedSet.delete(taskId);
  } else {
    completedSet.add(taskId);
  }

  const nextProgress: QuestProgress = {
    ...progress,
    completedTaskIds: Array.from(completedSet),
    isCompleted: false,
  };

  const isFullyCompleted = checkQuestCompletion(quest, nextProgress);
  if (isFullyCompleted) {
    nextProgress.isCompleted = true;
    nextProgress.completedAt = progress.completedAt ?? Date.now();
  }

  saveActiveQuest(quest, nextProgress);

  return nextProgress;
}
