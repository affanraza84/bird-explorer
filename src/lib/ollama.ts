import { BirdIdentification } from "@/types/bird";

export const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5vl:3b";

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
        err.message.includes("fetch failed")
      ) {
        throw new Error("Ollama is not running. Start Ollama and try again.");
      }
    }
    throw new Error(
      "Unable to connect to Ollama. Ensure Ollama is running on " +
        OLLAMA_BASE_URL
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
