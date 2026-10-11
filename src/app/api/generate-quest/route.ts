import { NextRequest, NextResponse } from "next/server";
import {
  generateQuestWithOllama,
  isOllamaUnavailableError,
} from "@/lib/ollama";
import { getBuiltinQuest, validateQuest } from "@/lib/builtin-quests";
import { GenerateQuestResponse, QuestDuration } from "@/types/quest";

export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateQuestResponse>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request body. Expected JSON with durationMinutes.",
      },
      { status: 400 }
    );
  }

  const { durationMinutes } = (body && typeof body === "object"
    ? body
    : {}) as { durationMinutes?: unknown };

  if (
    typeof durationMinutes !== "number" ||
    ![15, 30, 60].includes(durationMinutes)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid mission duration. Please select 15, 30, or 60 minutes.",
      },
      { status: 400 }
    );
  }

  const validDuration = durationMinutes as QuestDuration;

  try {
    // 1. Primary path: Attempt local Ollama generation
    const quest = await generateQuestWithOllama(validDuration);
    const validation = validateQuest(quest, validDuration);

    if (!validation.valid) {
      throw new Error(
        `Generated quest failed schema validation: ${validation.error || "unknown"}`
      );
    }

    return NextResponse.json({
      success: true,
      quest: {
        ...quest,
        source: "ollama",
      },
      generationSource: "ollama",
      message: "Mission generated using local Ollama AI.",
    });
  } catch (err: unknown) {
    // 2. Deterministic fallback ONLY when Ollama is unreachable, stopped, or times out
    if (isOllamaUnavailableError(err)) {
      const builtinQuest = getBuiltinQuest(validDuration);
      const validation = validateQuest(builtinQuest, validDuration);

      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: "Built-in quest template failed validation.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        quest: builtinQuest,
        generationSource: "builtin",
        message: "Using a built-in quest because local AI is unavailable.",
      });
    }

    // 3. Genuine internal errors or model format errors: DO NOT hide behind fallback
    const errorMessage =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred while generating quest.";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
