import { BirdSighting } from "@/types/bird";

export interface JournalJsonExportItem {
  id: string;
  species: string;
  description: string;
  confidence: string;
  createdAt: string;
  image?: string;
  audio?: string;
  audioMimeType?: string;
  audioDurationMs?: number;
  habitat?: string;
  weatherCondition?: string;
  tags?: string[];
}

/**
 * Converts a browser Blob into a Base64 data URL string.
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject(reader.error || new Error("Failed to convert Blob to Data URL"));
      };
      reader.readAsDataURL(blob);
    });
  }

  // Fallback for Node.js / testing environments
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = blob.type || "application/octet-stream";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

/**
 * Prepares the complete journal entries for JSON export by converting
 * image and audio Blobs to Base64 data URLs and including field observation metadata.
 */
export async function prepareJournalJson(
  sightings: BirdSighting[]
): Promise<JournalJsonExportItem[]> {
  const exportItems: JournalJsonExportItem[] = [];

  for (const sighting of sightings) {
    let imageDataUrl: string | undefined = undefined;
    if (sighting.image instanceof Blob) {
      try {
        imageDataUrl = await blobToDataUrl(sighting.image);
      } catch (err) {
        console.warn(`Could not serialize image for sighting ${sighting.id}:`, err);
      }
    }

    let audioDataUrl: string | undefined = undefined;
    if (sighting.audio instanceof Blob) {
      try {
        audioDataUrl = await blobToDataUrl(sighting.audio);
      } catch (err) {
        console.warn(`Could not serialize audio for sighting ${sighting.id}:`, err);
      }
    }

    const item: JournalJsonExportItem = {
      id: sighting.id,
      species: sighting.species,
      description: sighting.description,
      confidence: sighting.confidence,
      createdAt: new Date(sighting.createdAt).toISOString(),
    };

    if (imageDataUrl) {
      item.image = imageDataUrl;
    }

    if (sighting.habitat) {
      item.habitat = sighting.habitat;
    }

    if (sighting.weatherCondition) {
      item.weatherCondition = sighting.weatherCondition;
    }

    if (sighting.tags && sighting.tags.length > 0) {
      item.tags = [...sighting.tags];
    }

    if (audioDataUrl) {
      item.audio = audioDataUrl;
      item.audioMimeType = sighting.audioMimeType || "audio/webm";
      if (typeof sighting.audioDurationMs === "number") {
        item.audioDurationMs = sighting.audioDurationMs;
      }
    }

    exportItems.push(item);
  }

  return exportItems;
}

/**
 * Escapes a single CSV cell according to RFC 4180 rules.
 * Handles commas, quotes, and newlines.
 */
export function escapeCsvField(value: string | number | boolean | undefined | null): string {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);

  // If the string contains a comma, double-quote, or newline, wrap in quotes and escape quotes
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Generates RFC 4180 compliant CSV string from bird sightings.
 * Includes metadata, habitat, conditions, and tags.
 */
export function generateJournalCsv(sightings: BirdSighting[]): string {
  const headers = [
    "id",
    "species",
    "confidence",
    "description",
    "createdAt",
    "hasAudio",
    "audioDurationMs",
    "hasImage",
    "habitat",
    "weatherCondition",
    "tags",
  ];
  const headerLine = headers.join(",");

  const rows = sightings.map((sighting) => {
    const hasAudio = sighting.audio instanceof Blob;
    const hasImage = sighting.image instanceof Blob;
    const duration = typeof sighting.audioDurationMs === "number" ? sighting.audioDurationMs : "";
    const habitat = sighting.habitat || "";
    const weather = sighting.weatherCondition || "";
    const tags = sighting.tags && sighting.tags.length > 0 ? sighting.tags.join("; ") : "";

    return [
      escapeCsvField(sighting.id),
      escapeCsvField(sighting.species),
      escapeCsvField(sighting.confidence),
      escapeCsvField(sighting.description),
      escapeCsvField(new Date(sighting.createdAt).toISOString()),
      escapeCsvField(hasAudio),
      escapeCsvField(duration),
      escapeCsvField(hasImage),
      escapeCsvField(habitat),
      escapeCsvField(weather),
      escapeCsvField(tags),
    ].join(",");
  });

  return [headerLine, ...rows].join("\n");
}

/**
 * Triggers a native browser file download using Blob and temporary object URL.
 * Automatically cleans up the created URL to prevent memory leaks.
 */
export function triggerBrowserDownload(
  content: string | Blob,
  fileName: string,
  contentType: string
): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("triggerBrowserDownload must be executed in a browser environment.");
  }

  const blob = content instanceof Blob ? content : new Blob([content], { type: contentType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();

  // Clean up DOM and revoke object URL
  document.body.removeChild(anchor);
  setTimeout(() => {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Ignore cleanup error
    }
  }, 1000);
}

/**
 * Exports all journal sightings as a formatted JSON file download.
 */
export async function exportJournalAsJSON(sightings: BirdSighting[]): Promise<void> {
  if (!sightings || sightings.length === 0) {
    throw new Error("There are no observations to export yet.");
  }

  const data = await prepareJournalJson(sightings);
  const jsonString = JSON.stringify(data, null, 2);
  const timestamp = new Date().toISOString().slice(0, 10);
  triggerBrowserDownload(
    jsonString,
    `bird-journal-${timestamp}.json`,
    "application/json;charset=utf-8;"
  );
}

/**
 * Exports all journal sightings as a standard CSV file download.
 */
export function exportJournalAsCSV(sightings: BirdSighting[]): void {
  if (!sightings || sightings.length === 0) {
    throw new Error("There are no observations to export yet.");
  }

  const csvString = generateJournalCsv(sightings);
  const timestamp = new Date().toISOString().slice(0, 10);
  triggerBrowserDownload(
    csvString,
    `bird-journal-${timestamp}.csv`,
    "text/csv;charset=utf-8;"
  );
}
