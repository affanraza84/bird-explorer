import type { BirdSighting } from "@/types/bird";

const DB_NAME = "bird_explorer_journal_db";
const DB_VERSION = 1;
const STORE_NAME = "sightings";

/**
 * Checks if IndexedDB is available in the current browser environment.
 */
export function isIndexedDBAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

/**
 * Opens or upgrades the IndexedDB instance for the bird journal.
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
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
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

  if (!data.image || !(data.image instanceof Blob)) {
    throw new Error("Cannot save sighting: valid image blob is required.");
  }

  const sighting: BirdSighting = {
    id: data.id || generateUniqueId(),
    species: data.species.trim(),
    confidence: data.confidence || "Likely species",
    description: data.description || "",
    image: data.image,
    createdAt: data.createdAt ?? Date.now(),
  };

  const db = await openDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

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
 */
export async function getSightings(): Promise<BirdSighting[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const rawSightings = (request.result || []) as BirdSighting[];

        // Filter any corrupted entries that lack an image blob or ID
        const validSightings = rawSightings.filter(
          (s) => s && typeof s.id === "string" && s.image instanceof Blob
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
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
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
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
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
