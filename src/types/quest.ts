export type QuestDuration = 15 | 30 | 60;

export type QuestTaskType = "discovery" | "photo" | "observation" | "general" | "movement";

export type LocationTrackingStatus =
  | "tracking"
  | "denied"
  | "unavailable"
  | "error"
  | "unsupported"
  | "idle";

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export type QuestGenerationSource = "ollama" | "builtin";

export interface QuestTask {
  id: string;
  text: string;
  isCompleted: boolean;
  type: QuestTaskType;
}

export interface Quest {
  id: string;
  title: string;
  durationMinutes: QuestDuration;
  targetBirds: number;
  distanceTargetMeters: number;
  tasks: QuestTask[];
  createdAt: number;
  source?: QuestGenerationSource;
  sourceNotice?: string;
}

export interface QuestProgress {
  questId: string;
  discoveredSpecies: string[]; // List of unique common names discovered
  photosCaptured: number;
  completedTaskIds: string[];
  distanceWalkedMeters: number; // Derived accumulated outdoor distance
  locationStatus: LocationTrackingStatus;
  isCompleted: boolean;
  completedAt?: number;
}

export interface GenerateQuestRequest {
  durationMinutes: QuestDuration;
}

export interface GenerateQuestSuccessResponse {
  success: true;
  quest: Quest;
  generationSource: QuestGenerationSource;
  message?: string;
}

export interface GenerateQuestErrorResponse {
  success: false;
  error: string;
}

export type GenerateQuestResponse =
  | GenerateQuestSuccessResponse
  | GenerateQuestErrorResponse;
