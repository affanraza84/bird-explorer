import { NextRequest, NextResponse } from "next/server";
import { generateQuestWithOllama } from "@/lib/ollama";
import { GenerateQuestResponse, QuestDuration } from "@/types/quest";

export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateQuestResponse>> {
  try {
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
          error:
            "Invalid mission duration. Please select 15, 30, or 60 minutes.",
        },
        { status: 400 }
      );
    }

    const quest = await generateQuestWithOllama(
      durationMinutes as QuestDuration
    );

    return NextResponse.json({
      success: true,
      quest,
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "Failed to generate quest. Please ensure Ollama is running.";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
