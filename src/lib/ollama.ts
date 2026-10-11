import { BirdIdentification } from "@/types/bird";
import { Quest, QuestDuration, QuestTask, QuestTaskType } from "@/types/quest";

export const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5vl:3b";
export const OLLAMA_QUEST_MODEL =
  process.env.OLLAMA_QUEST_MODEL || "qwen3:4b";

export class OllamaUnavailableError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = "OllamaUnavailableError";
  }
}

export class OllamaModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaModelError";
  }
}

/**
 * Checks whether an error represents Ollama being unreachable, timed out, or stopped.
 */
export function isOllamaUnavailableError(err: unknown): boolean {
  if (err instanceof OllamaUnavailableError) {
    return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    const name = err.name.toLowerCase();
    if (
      name === "aborterror" ||
      msg.includes("econnrefused") ||
      msg.includes("fetch failed") ||
      msg.includes("enotfound") ||
      msg.includes("ehostunreach") ||
      msg.includes("network error") ||
      msg.includes("timed out") ||
      msg.includes("local ai could not generate a quest") ||
      msg.includes("ollama is not running") ||
      msg.includes("unable to connect to ollama") ||
      msg.includes("service unavailable")
    ) {
      return true;
    }
  }
  return false;
}

const SYSTEM_PROMPT = `You are a bird identification assistant. Analyze the image and identify the bird species.

Guidelines:
1. Identify the likely bird species (provide both the common name and scientific name if known, e.g. "American Robin (Turdus migratorius)").
2. Provide a concise, informative description highlighting key field marks (plumage colors, beak shape, eye markings, silhouette, or distinct features).
3. If the image is unclear, blurry, shows only ambiguous bird parts, or does NOT contain a bird, set species to "Unable to confidently identify the species from this image." and set confidence to "Uncertain".
4. Do NOT use fake percentage numbers (avoid "94%", "87%"). Use qualitative confidence categories: "Likely species", "Possible match", or "Uncertain".
5. Output ONLY valid JSON in this exact structure:
{
  "species": "Common name (Scientific name)",
  "confidence": "Likely species" | "Possible match" | "Uncertain",
  "description": "Concise description of the observable field marks and reasoning."
}`;

export async function identifyBirdWithOllama(
  imageBase64: string
): Promise<BirdIdentification> {
  const url = `${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/generate`;

  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: SYSTEM_PROMPT,
        images: [imageBase64],
        stream: false,
        format: "json",
        options: {
          temperature: 0.2,
        },
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new Error(
          "AI inference timed out. Your local system may be under heavy load, or the image may be very large."
        );
      }
      if (
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("fetch failed") ||
        err.message.includes("ENOTFOUND") ||
        err.message.includes("EHOSTUNREACH")
      ) {
        throw new Error(
          "Local AI vision model is unavailable. In a deployed environment or when Ollama is not running locally, photo identification requires a local Ollama instance (qwen2.5vl:3b at http://localhost:11434). You can still log observations manually via the offline Regional Checklist."
        );
      }
    }
    throw new Error(
      "Unable to connect to Ollama on " +
        OLLAMA_BASE_URL +
        ". Vision identification requires a local Ollama instance."
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    if (response.status === 404 || errorText.toLowerCase().includes("not found")) {
      throw new Error(
        `Model '${OLLAMA_MODEL}' was not found in Ollama. Run 'ollama pull ${OLLAMA_MODEL}' in your terminal and try again.`
      );
    }
    throw new Error(
      `Ollama request failed (${response.status}): ${errorText || response.statusText}`
    );
  }

  const data = (await response.json()) as { response?: string };

  if (!data || typeof data.response !== "string" || !data.response.trim()) {
    throw new Error("Ollama returned an empty response.");
  }

  let parsed: unknown;
  const rawText = data.response.trim();

  try {
    parsed = JSON.parse(rawText);
  } catch {
    // If wrapped in markdown code blocks, strip them
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(
        "Model returned an unexpected response format. Please try again."
      );
    }
  }

  const obj = parsed as Record<string, unknown>;

  const species =
    typeof obj.species === "string" && obj.species.trim()
      ? obj.species.trim()
      : "Unable to confidently identify the species from this image.";

  const confidence =
    typeof obj.confidence === "string" && obj.confidence.trim()
      ? obj.confidence.trim()
      : "Uncertain";

  const description =
    typeof obj.description === "string" && obj.description.trim()
      ? obj.description.trim()
      : "No detailed description was provided by the vision model.";

  return {
    species,
    confidence,
    description,
  };
}

function detectTaskType(text: string): QuestTaskType {
  const lower = text.toLowerCase();
  if (lower.includes("photo") || lower.includes("picture") || lower.includes("camera")) {
    return "photo";
  }
  if (lower.includes("find") || lower.includes("spot") || lower.includes("discover") || lower.includes("species")) {
    return "discovery";
  }
  if (lower.includes("observe") || lower.includes("listen") || lower.includes("quiet") || lower.includes("hear") || lower.includes("watch")) {
    return "observation";
  }
  return "general";
}

export async function generateQuestWithOllama(
  durationMinutes: QuestDuration
): Promise<Quest> {
  const defaultTarget = durationMinutes === 15 ? 1 : durationMinutes === 30 ? 2 : 3;

  const prompt = `You are a nature educator creating an engaging beginner outdoor birdwatching mission for the "Touch Grass" open-source AI challenge.
Generate a ${durationMinutes}-minute outdoor birdwatching mission.

Guidelines:
1. title: Creative, nature-focused title (e.g. "${durationMinutes}-Minute Park Canopy Expedition" or "Morning Woodland Bird Hunt").
2. durationMinutes: MUST be exactly ${durationMinutes}.
3. targetBirds: MUST be ${defaultTarget}.
4. tasks: Exactly 2 to 4 actionable, inspiring mission tasks. Must include:
   - One bird finding task (e.g. "Find ${defaultTarget} different bird species")
   - One photography task (e.g. "Photograph at least 1 bird")
   - One quiet observation or listening task (e.g. "Observe one bird quietly for 2 minutes without moving" or "Listen for 3 distinct bird calls")

Output ONLY valid JSON adhering strictly to this structure:
{
  "title": "Mission title",
  "durationMinutes": ${durationMinutes},
  "targetBirds": ${defaultTarget},
  "tasks": [
    "Task 1 description",
    "Task 2 description",
    "Task 3 description"
  ]
}`;

  const url = `${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/generate`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_QUEST_MODEL,
        prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0.3,
        },
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new OllamaUnavailableError(
          "Quest generation timed out. Local AI service took too long to respond.",
          err
        );
      }
      if (
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("fetch failed") ||
        err.message.includes("ENOTFOUND") ||
        err.message.includes("EHOSTUNREACH")
      ) {
        throw new OllamaUnavailableError(
          "Local AI could not generate a quest. Make sure Ollama is running.",
          err
        );
      }
    }
    throw new OllamaUnavailableError(
      "Unable to connect to Ollama. Ensure Ollama is running on " +
        OLLAMA_BASE_URL,
      err
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new OllamaUnavailableError(
      `Ollama service unavailable (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    if (response.status === 404 || errorText.toLowerCase().includes("not found")) {
      throw new OllamaModelError(
        `Model '${OLLAMA_QUEST_MODEL}' not found in Ollama. Run 'ollama pull ${OLLAMA_QUEST_MODEL}'.`
      );
    }
    throw new OllamaModelError(
      `Ollama quest generation failed (${response.status}): ${errorText || response.statusText}`
    );
  }

  const data = (await response.json()) as { response?: string };

  if (!data || typeof data.response !== "string" || !data.response.trim()) {
    throw new OllamaModelError("Ollama returned an empty response for quest generation.");
  }

  let parsed: unknown;
  const rawText = data.response.trim();

  try {
    parsed = JSON.parse(rawText);
  } catch {
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new OllamaModelError(
        "Model returned invalid JSON for the quest. Please try again."
      );
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new OllamaModelError(
      "Model returned invalid JSON structure for the quest."
    );
  }

  const obj = parsed as Record<string, unknown>;

  // Validate and sanitize title
  const title =
    typeof obj.title === "string" && obj.title.trim()
      ? obj.title.trim()
      : `${durationMinutes}-Minute Outdoor Bird Quest`;

  // Validate and sanitize targetBirds
  const targetBirds =
    typeof obj.targetBirds === "number" && Number.isInteger(obj.targetBirds) && obj.targetBirds >= 1 && obj.targetBirds <= 6
      ? obj.targetBirds
      : defaultTarget;

  // Validate and sanitize tasks array
  let rawTasks: string[] = [];
  if (Array.isArray(obj.tasks)) {
    rawTasks = obj.tasks
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim());
  }

  // Fallback tasks if the model produced an empty or invalid array
  if (rawTasks.length < 2) {
    rawTasks = [
      `Find ${targetBirds} different bird species`,
      "Photograph at least 1 bird",
      "Observe one bird quietly for 2 minutes",
    ];
  }

  const tasks: QuestTask[] = rawTasks.slice(0, 4).map((taskStr, index) => ({
    id: `task_${index + 1}`,
    text: taskStr,
    isCompleted: false,
    type: detectTaskType(taskStr),
  }));

  const distanceTargetMeters =
    durationMinutes === 15 ? 500 : durationMinutes === 30 ? 1000 : 2000;

  const questId = `quest_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  return {
    id: questId,
    title,
    durationMinutes,
    targetBirds,
    distanceTargetMeters,
    tasks,
    createdAt: Date.now(),
    source: "ollama",
  };
}
