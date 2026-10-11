import { NextResponse } from "next/server";
import { OLLAMA_BASE_URL, OLLAMA_MODEL } from "@/lib/ollama";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/tags`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!res.ok) {
      return NextResponse.json({
        available: false,
        model: OLLAMA_MODEL,
        modelFound: false,
      });
    }

    const data = (await res.json()) as { models?: Array<{ name: string; model: string }> };
    const models = data.models || [];
    const modelFound = models.some(
      (m) =>
        m.name === OLLAMA_MODEL ||
        m.model === OLLAMA_MODEL ||
        m.name.startsWith(OLLAMA_MODEL)
    );

    return NextResponse.json({
      available: true,
      model: OLLAMA_MODEL,
      modelFound,
    });
  } catch {
    return NextResponse.json({
      available: false,
      model: OLLAMA_MODEL,
      modelFound: false,
    });
  }
}
