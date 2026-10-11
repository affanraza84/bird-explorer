import type { BirdSighting, Habitat, WeatherCondition, ObservationTag } from "@/types/bird";
import type { ChecklistObservationRecord } from "@/types/checklist";

const DB_NAME = "bird_explorer_journal_db";
const DB_VERSION = 3;
const SIGHTINGS_STORE = "sightings";
const CHECKLIST_STORE = "checklist_history";

export const VALID_HABITATS: readonly Habitat[] = [
  "woodland",
  "wetland",
  "grassland",
  "urban",
  "garden",
  "farmland",
  "coastal",
  "other",
] as const;

export const VALID_WEATHER_CONDITIONS: readonly WeatherCondition[] = [
  "sunny",
  "partly-cloudy",
  "overcast",
  "rainy",
  "foggy",
] as const;

export const VALID_OBSERVATION_TAGS: readonly ObservationTag[] = [
  "feeding",
  "flying",
  "perched",
  "singing",
  "calling",
  "nesting",
  "drinking",
  "bathing",
  "foraging",
  "flocking",
] as const;

/**
 * Validates a habitat string.
 */
export function validateHabitat(habitat?: unknown): Habitat | undefined {
  if (habitat === undefined || habitat === null || habitat === "") return undefined;
  if (typeof habitat === "string" && VALID_HABITATS.includes(habitat as Habitat)) {
    return habitat as Habitat;
  }
  throw new Error(
    `Invalid habitat: "${habitat}". Must be one of: ${VALID_HABITATS.join(", ")}`
  );
}

/**
 * Validates a weather condition string.
 */
export function validateWeatherCondition(cond?: unknown): WeatherCondition | undefined {
  if (cond === undefined || cond === null || cond === "") return undefined;
  if (typeof cond === "string" && VALID_WEATHER_CONDITIONS.includes(cond as WeatherCondition)) {
    return cond as WeatherCondition;
  }
  throw new Error(
    `Invalid weather condition: "${cond}". Must be one of: ${VALID_WEATHER_CONDITIONS.join(", ")}`
  );
}

/**
 * Validates and deduplicates observation tags.
 */
export function validateObservationTags(tags?: unknown): ObservationTag[] | undefined {
  if (tags === undefined || tags === null) return undefined;
  if (!Array.isArray(tags)) {
    throw new Error("Observation tags must be an array.");
  }

  const uniqueTags: ObservationTag[] = [];
  for (const t of tags) {
    if (typeof t !== "string" || !VALID_OBSERVATION_TAGS.includes(t as ObservationTag)) {
      throw new Error(
        `Invalid observation tag: "${t}". Must be one of: ${VALID_OBSERVATION_TAGS.join(", ")}`
      );
    }
    if (!uniqueTags.includes(t as ObservationTag)) {
      uniqueTags.push(t as ObservationTag);
    }
  }

  return uniqueTags.length > 0 ? uniqueTags : undefined;
}

/**
 * Checks if IndexedDB is available in the current browser environment.
 */
export function isIndexedDBAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

/**
 * Opens or upgrades the IndexedDB instance for the bird journal and checklist history.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(
        new Error(
          "IndexedDB is not supported or is disabled in your browser. Local persistence requires IndexedDB."
        )
      );
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SIGHTINGS_STORE)) {
        const store = db.createObjectStore(SIGHTINGS_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(CHECKLIST_STORE)) {
        const checklistStore = db.createObjectStore(CHECKLIST_STORE, { keyPath: "speciesId" });
        checklistStore.createIndex("lastObservedAt", "lastObservedAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      const error = request.error;
      reject(
        new Error(
          `Failed to open local journal database: ${error?.message || "Unknown error"}`
        )
      );
    };

    request.onblocked = () => {
      reject(
        new Error(
          "Journal database is blocked by another open tab or window. Please close other tabs and try again."
        )
      );
    };
  });
}

/**
 * Generates a collision-resistant unique ID.
 */
function generateUniqueId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sighting_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Saves a new bird sighting to IndexedDB.
 * Supports image Blobs, optional audio notes, and optional field metadata (habitat, condition, tags).
 * For manual field observations without photos, image can be omitted/undefined.
 */
export async function saveSighting(
  data: Omit<BirdSighting, "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
  }
): Promise<BirdSighting> {
  if (!data.species || !data.species.trim()) {
    throw new Error("Cannot save sighting: species name is missing.");
  }

  // If image is explicitly null or invalid non-Blob object, throw error
  if (data.image === null || (data.image !== undefined && !(data.image instanceof Blob))) {
    throw new Error("Cannot save sighting: valid image blob is required.");
  }

  const validatedHabitat = validateHabitat(data.habitat);
  const validatedWeather = validateWeatherCondition(data.weatherCondition);
  const validatedTags = validateObservationTags(data.tags);

  const sighting: BirdSighting = {
    id: data.id || generateUniqueId(),
    species: data.species.trim(),
    confidence: data.confidence || "Likely species",
    description: data.description || "",
    createdAt: data.createdAt ?? Date.now(),
  };

  if (data.image instanceof Blob) {
    sighting.image = data.image;
  }

  if (validatedHabitat) {
    sighting.habitat = validatedHabitat;
  }

  if (validatedWeather) {
    sighting.weatherCondition = validatedWeather;
  }

  if (validatedTags && validatedTags.length > 0) {
    sighting.tags = validatedTags;
  }

  if (data.audio instanceof Blob) {
    sighting.audio = data.audio;
    sighting.audioMimeType = data.audioMimeType || data.audio.type || "audio/webm";
    if (typeof data.audioDurationMs === "number") {
      sighting.audioDurationMs = data.audioDurationMs;
    }
  }

  const db = await openDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(SIGHTINGS_STORE, "readwrite");
      const store = tx.objectStore(SIGHTINGS_STORE);

      const request = store.put(sighting);

      request.onerror = () => {
        reject(
          new Error(
            `Failed to save sighting: ${request.error?.message || "Storage transaction error"}`
          )
        );
      };

      tx.oncomplete = () => {
        resolve(sighting);
      };

      tx.onerror = () => {
        reject(
          new Error(
            `Database transaction failed while saving sighting: ${tx.error?.message || "Unknown error"}`
          )
        );
      };

      tx.onabort = () => {
        reject(new Error("Database transaction was aborted while saving."));
      };
    } catch (err: unknown) {
      reject(
        new Error(
          `Unexpected error saving sighting: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  });
}

/**
 * Retrieves all saved bird sightings from IndexedDB, sorted newest-first.
 * Supports both photo sightings and photo-less manual field observations.
 */
export async function getSightings(): Promise<BirdSighting[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(SIGHTINGS_STORE, "readonly");
      const store = tx.objectStore(SIGHTINGS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const rawSightings = (request.result || []) as BirdSighting[];

        // Keep entries that have a valid ID and either no image or a valid Blob image
        const validSightings = rawSightings.filter(
          (s) =>
            s &&
            typeof s.id === "string" &&
            (s.image === undefined || s.image instanceof Blob)
        );

        // Sort descending by timestamp (newest first)
        validSightings.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        resolve(validSightings);
      };

      request.onerror = () => {
        reject(
          new Error(
            `Failed to load sightings: ${request.error?.message || "Unknown error"}`
          )
        );
      };

      tx.onerror = () => {
        reject(
          new Error(
            `Transaction error while loading sightings: ${tx.error?.message || "Unknown error"}`
          )
        );
      };
    } catch (err: unknown) {
      reject(
        new Error(
          `Unexpected error retrieving sightings: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  });
}

/**
 * Deletes a single bird sighting by its unique ID.
 */
export async function deleteSighting(id: string): Promise<void> {
  if (!id) {
    throw new Error("A valid sighting ID is required for deletion.");
  }

  const db = await openDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(SIGHTINGS_STORE, "readwrite");
      const store = tx.objectStore(SIGHTINGS_STORE);
      const request = store.delete(id);

      request.onerror = () => {
        reject(
          new Error(
            `Failed to delete sighting: ${request.error?.message || "Storage error"}`
          )
        );
      };

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        reject(
          new Error(
            `Transaction error while deleting sighting: ${tx.error?.message || "Unknown error"}`
          )
        );
      };
    } catch (err: unknown) {
      reject(
        new Error(
          `Unexpected error deleting sighting: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  });
}

/**
 * Clears all bird sightings from the journal.
 */
export async function clearSightings(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(SIGHTINGS_STORE, "readwrite");
      const store = tx.objectStore(SIGHTINGS_STORE);
      const request = store.clear();

      request.onerror = () => {
        reject(
          new Error(
            `Failed to clear journal: ${request.error?.message || "Storage error"}`
          )
        );
      };

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        reject(
          new Error(
            `Transaction error while clearing journal: ${tx.error?.message || "Unknown error"}`
          )
        );
      };
    } catch (err: unknown) {
      reject(
        new Error(
          `Unexpected error clearing journal: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  });
}

/**
 * Retrieves a single sighting by ID.
 */
export async function getSightingById(id: string): Promise<BirdSighting | null> {
  if (!id) return null;

  const db = await openDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(SIGHTINGS_STORE, "readonly");
      const store = tx.objectStore(SIGHTINGS_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as BirdSighting | undefined;
        resolve(result || null);
      };

      request.onerror = () => {
        reject(
          new Error(
            `Failed to retrieve sighting: ${request.error?.message || "Storage error"}`
          )
        );
      };
    } catch (err: unknown) {
      reject(
        new Error(
          `Unexpected error getting sighting: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  });
}

/**
 * Updates metadata (habitat, weatherCondition, tags, description) for an existing sighting.
 */
export async function updateSightingMetadata(
  id: string,
  metadata: {
    habitat?: Habitat;
    weatherCondition?: WeatherCondition;
    tags?: ObservationTag[];
    description?: string;
  }
): Promise<BirdSighting> {
  if (!id) {
    throw new Error("A valid sighting ID is required to update metadata.");
  }

  const existing = await getSightingById(id);
  if (!existing) {
    throw new Error(`Sighting with ID "${id}" was not found.`);
  }

  const validatedHabitat = validateHabitat(metadata.habitat);
  const validatedWeather = validateWeatherCondition(metadata.weatherCondition);
  const validatedTags = validateObservationTags(metadata.tags);

  const updated: BirdSighting = {
    ...existing,
    habitat: validatedHabitat,
    weatherCondition: validatedWeather,
    tags: validatedTags,
    description: metadata.description !== undefined ? metadata.description : existing.description,
  };

  const db = await openDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(SIGHTINGS_STORE, "readwrite");
      const store = tx.objectStore(SIGHTINGS_STORE);
      const request = store.put(updated);

      request.onerror = () => {
        reject(
          new Error(
            `Failed to update sighting metadata: ${request.error?.message || "Storage error"}`
          )
        );
      };

      tx.oncomplete = () => {
        resolve(updated);
      };

      tx.onerror = () => {
        reject(
          new Error(
            `Transaction error updating sighting: ${tx.error?.message || "Unknown error"}`
          )
        );
      };
    } catch (err: unknown) {
      reject(
        new Error(
          `Unexpected error updating sighting: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  });
}

/**
 * Attaches or replaces an audio field note on an existing sighting.
 */
export async function attachAudioToSighting(
  id: string,
  audioBlob: Blob,
  durationMs?: number,
  mimeType?: string
): Promise<BirdSighting> {
  if (!id) {
    throw new Error("A valid sighting ID is required to attach audio.");
  }
  if (!audioBlob || !(audioBlob instanceof Blob)) {
    throw new Error("A valid audio Blob is required.");
  }

  const existing = await getSightingById(id);
  if (!existing) {
    throw new Error(`Sighting with ID "${id}" was not found.`);
  }

  const updated: BirdSighting = {
    ...existing,
    audio: audioBlob,
    audioMimeType: mimeType || audioBlob.type || "audio/webm",
    audioDurationMs: typeof durationMs === "number" ? durationMs : undefined,
  };

  const db = await openDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(SIGHTINGS_STORE, "readwrite");
      const store = tx.objectStore(SIGHTINGS_STORE);
      const request = store.put(updated);

      request.onerror = () => {
        reject(
          new Error(
            `Failed to update audio on sighting: ${request.error?.message || "Storage error"}`
          )
        );
      };

      tx.oncomplete = () => {
        resolve(updated);
      };

      tx.onerror = () => {
        reject(
          new Error(
            `Transaction error attaching audio: ${tx.error?.message || "Unknown error"}`
          )
        );
      };
    } catch (err: unknown) {
      reject(
        new Error(
          `Unexpected error updating audio: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  });
}

/**
 * Removes the audio field note from an existing sighting.
 */
export async function removeAudioFromSighting(id: string): Promise<BirdSighting> {
  if (!id) {
    throw new Error("A valid sighting ID is required to remove audio.");
  }

  const existing = await getSightingById(id);
  if (!existing) {
    throw new Error(`Sighting with ID "${id}" was not found.`);
  }

  const updated: BirdSighting = { ...existing };
  delete updated.audio;
  delete updated.audioMimeType;
  delete updated.audioDurationMs;

  const db = await openDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(SIGHTINGS_STORE, "readwrite");
      const store = tx.objectStore(SIGHTINGS_STORE);
      const request = store.put(updated);

      request.onerror = () => {
        reject(
          new Error(
            `Failed to remove audio from sighting: ${request.error?.message || "Storage error"}`
          )
        );
      };

      tx.oncomplete = () => {
        resolve(updated);
      };

      tx.onerror = () => {
        reject(
          new Error(
            `Transaction error removing audio: ${tx.error?.message || "Unknown error"}`
          )
        );
      };
    } catch (err: unknown) {
      reject(
        new Error(
          `Unexpected error removing audio: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  });
}

// ==========================================
// CHECKLIST HISTORY METHODS
// ==========================================

/**
 * Retrieves all checklist observation records from IndexedDB.
 */
export async function getChecklistHistory(): Promise<ChecklistObservationRecord[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(CHECKLIST_STORE, "readonly");
      const store = tx.objectStore(CHECKLIST_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result || []) as ChecklistObservationRecord[]);
      };

      request.onerror = () => {
        reject(
          new Error(
            `Failed to load checklist history: ${request.error?.message || "Unknown error"}`
          )
        );
      };
    } catch (err: unknown) {
      reject(
        new Error(
          `Unexpected error loading checklist history: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  });
}

/**
 * Retrieves a single checklist observation record by species ID.
 */
export async function getChecklistRecord(speciesId: string): Promise<ChecklistObservationRecord | null> {
  if (!speciesId) return null;
  const db = await openDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(CHECKLIST_STORE, "readonly");
      const store = tx.objectStore(CHECKLIST_STORE);
      const request = store.get(speciesId);

      request.onsuccess = () => {
        resolve((request.result as ChecklistObservationRecord) || null);
      };

      request.onerror = () => {
        reject(
          new Error(
            `Failed to get checklist record: ${request.error?.message || "Storage error"}`
          )
        );
      };
    } catch (err: unknown) {
      reject(
        new Error(
          `Unexpected error getting checklist record: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  });
}

/**
 * Marks or increments an observation of a checklist species.
 */
export async function recordChecklistSighting(
  speciesId: string,
  timestamp?: string
): Promise<ChecklistObservationRecord> {
  if (!speciesId) {
    throw new Error("Species ID is required to record checklist sighting.");
  }

  const existing = await getChecklistRecord(speciesId);
  const now = timestamp || new Date().toISOString();

  const record: ChecklistObservationRecord = existing
    ? {
        speciesId,
        firstObservedAt: existing.firstObservedAt,
        lastObservedAt: now,
        observationCount: (existing.observationCount || 1) + 1,
      }
    : {
        speciesId,
        firstObservedAt: now,
        lastObservedAt: now,
        observationCount: 1,
      };

  const db = await openDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(CHECKLIST_STORE, "readwrite");
      const store = tx.objectStore(CHECKLIST_STORE);
      const request = store.put(record);

      request.onsuccess = () => {
        resolve(record);
      };

      request.onerror = () => {
        reject(
          new Error(
            `Failed to record checklist sighting: ${request.error?.message || "Storage error"}`
          )
        );
      };
    } catch (err: unknown) {
      reject(
        new Error(
          `Unexpected error recording checklist sighting: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  });
}

/**
 * Clears all checklist history from IndexedDB.
 */
export async function clearChecklistHistory(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(CHECKLIST_STORE, "readwrite");
      const store = tx.objectStore(CHECKLIST_STORE);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(
          new Error(
            `Failed to clear checklist history: ${request.error?.message || "Storage error"}`
          )
        );
      };
    } catch (err: unknown) {
      reject(
        new Error(
          `Unexpected error clearing checklist history: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  });
}
