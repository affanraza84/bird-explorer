import { Quest, QuestDuration, QuestTask } from "@/types/quest";

export const BUILTIN_QUEST_TEMPLATES: Record<
  QuestDuration,
  {
    title: string;
    targetBirds: number;
    distanceTargetMeters: number;
    tasks: Omit<QuestTask, "id" | "isCompleted">[];
  }
> = {
  15: {
    title: "15-Minute Local Habitat Quest",
    targetBirds: 1,
    distanceTargetMeters: 500,
    tasks: [
      {
        text: "Spot 1 bird resting or foraging in nearby trees or shrubs",
        type: "discovery",
      },
      {
        text: "Photograph at least 1 bird",
        type: "photo",
      },
      {
        text: "Pause quietly for 2 minutes to listen for chirps or calls",
        type: "observation",
      },
    ],
  },
  30: {
    title: "30-Minute Woodland & Park Quest",
    targetBirds: 2,
    distanceTargetMeters: 1000,
    tasks: [
      {
        text: "Find 2 different bird species in distinct perches or habitats",
        type: "discovery",
      },
      {
        text: "Photograph at least 1 bird",
        type: "photo",
      },
      {
        text: "Observe a perched bird quietly for 3 minutes without moving",
        type: "observation",
      },
      {
        text: "Scan tree canopies or fence lines for birds in flight",
        type: "observation",
      },
    ],
  },
  60: {
    title: "60-Minute Outdoor Trail Expedition",
    targetBirds: 3,
    distanceTargetMeters: 2000,
    tasks: [
      {
        text: "Discover 3 different bird species across your trail route",
        type: "discovery",
      },
      {
        text: "Photograph at least 1 bird in its natural environment",
        type: "photo",
      },
      {
        text: "Stand motionless for 5 minutes in a shaded spot and listen for bird calls",
        type: "observation",
      },
      {
        text: "Observe ground-level foraging or canopy feeding behavior",
        type: "observation",
      },
    ],
  },
};

/**
 * Returns a valid, deterministic built-in quest for the requested duration.
 */
export function getBuiltinQuest(durationMinutes: QuestDuration): Quest {
  const template = BUILTIN_QUEST_TEMPLATES[durationMinutes];
  if (!template) {
    throw new Error(`Unsupported quest duration: ${durationMinutes}`);
  }

  const tasks: QuestTask[] = template.tasks.map((task, index) => ({
    id: `task_${index + 1}`,
    text: task.text,
    type: task.type,
    isCompleted: false,
  }));

  const questId = `quest_builtin_${durationMinutes}_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 7)}`;

  return {
    id: questId,
    title: template.title,
    durationMinutes,
    targetBirds: template.targetBirds,
    distanceTargetMeters: template.distanceTargetMeters,
    tasks,
    createdAt: Date.now(),
    source: "builtin",
    sourceNotice: "Using a built-in quest because local AI is unavailable.",
  };
}

export interface QuestValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a Quest object ensuring schema compliance and logical target bounds.
 */
export function validateQuest(
  quest: unknown,
  expectedDuration?: QuestDuration
): QuestValidationResult {
  if (!quest || typeof quest !== "object") {
    return { valid: false, error: "Quest must be an object." };
  }

  const q = quest as Record<string, unknown>;

  if (typeof q.id !== "string" || !q.id.trim()) {
    return { valid: false, error: "Quest id must be a non-empty string." };
  }

  if (typeof q.title !== "string" || !q.title.trim()) {
    return { valid: false, error: "Quest title must be a non-empty string." };
  }

  const validDurations: QuestDuration[] = [15, 30, 60];
  if (
    typeof q.durationMinutes !== "number" ||
    !validDurations.includes(q.durationMinutes as QuestDuration)
  ) {
    return {
      valid: false,
      error: "Quest durationMinutes must be 15, 30, or 60.",
    };
  }

  if (expectedDuration && q.durationMinutes !== expectedDuration) {
    return {
      valid: false,
      error: `Quest durationMinutes (${q.durationMinutes}) does not match expected duration (${expectedDuration}).`,
    };
  }

  const expectedDistance =
    q.durationMinutes === 15 ? 500 : q.durationMinutes === 30 ? 1000 : 2000;
  if (
    typeof q.distanceTargetMeters !== "number" ||
    q.distanceTargetMeters !== expectedDistance
  ) {
    return {
      valid: false,
      error: `Quest distanceTargetMeters must be ${expectedDistance}m for a ${q.durationMinutes}-minute quest.`,
    };
  }

  const expectedTargetBirds =
    q.durationMinutes === 15 ? 1 : q.durationMinutes === 30 ? 2 : 3;
  if (
    typeof q.targetBirds !== "number" ||
    !Number.isInteger(q.targetBirds) ||
    q.targetBirds !== expectedTargetBirds
  ) {
    return {
      valid: false,
      error: `Quest targetBirds must be ${expectedTargetBirds} for a ${q.durationMinutes}-minute quest.`,
    };
  }

  if (!Array.isArray(q.tasks) || q.tasks.length < 2 || q.tasks.length > 5) {
    return {
      valid: false,
      error: "Quest tasks must be an array of 2 to 5 tasks.",
    };
  }

  const validTaskTypes = new Set([
    "discovery",
    "photo",
    "observation",
    "general",
    "movement",
  ]);

  for (let i = 0; i < q.tasks.length; i++) {
    const task = q.tasks[i];
    if (!task || typeof task !== "object") {
      return { valid: false, error: `Task at index ${i} must be an object.` };
    }
    const t = task as Record<string, unknown>;
    if (typeof t.id !== "string" || !t.id.trim()) {
      return {
        valid: false,
        error: `Task at index ${i} must have a non-empty string id.`,
      };
    }
    if (typeof t.text !== "string" || !t.text.trim()) {
      return {
        valid: false,
        error: `Task at index ${i} must have a non-empty text description.`,
      };
    }
    if (typeof t.isCompleted !== "boolean") {
      return {
        valid: false,
        error: `Task at index ${i} isCompleted must be boolean.`,
      };
    }
    if (typeof t.type !== "string" || !validTaskTypes.has(t.type)) {
      return {
        valid: false,
        error: `Task at index ${i} has invalid type: ${t.type}.`,
      };
    }
  }

  if (typeof q.createdAt !== "number" || q.createdAt <= 0) {
    return {
      valid: false,
      error: "Quest createdAt must be a valid positive timestamp.",
    };
  }

  return { valid: true };
}
