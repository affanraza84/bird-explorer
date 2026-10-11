import { BirdChecklistEntry } from "@/types/checklist";
import { Habitat } from "@/types/bird";

export function normalizeSpeciesName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[()[\]{}]/g, " ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deterministically match an AI species string to a bundled checklist entry.
 * Checks normalized commonName, scientificName, and sub-tokens.
 * Returns null if no valid checklist entry matches.
 */
export function matchSpeciesToChecklist(
  rawSpeciesName: string,
  checklist: BirdChecklistEntry[]
): BirdChecklistEntry | null {
  if (!rawSpeciesName || !checklist || checklist.length === 0) return null;

  const normalizedInput = normalizeSpeciesName(rawSpeciesName);
  if (!normalizedInput) return null;

  // 1. Exact match with common name
  for (const entry of checklist) {
    if (normalizeSpeciesName(entry.commonName) === normalizedInput) {
      return entry;
    }
  }

  // 2. Exact match with scientific name
  for (const entry of checklist) {
    if (entry.scientificName && normalizeSpeciesName(entry.scientificName) === normalizedInput) {
      return entry;
    }
  }

  // 3. Check if entry's normalized common name or scientific name is fully contained in normalized input
  // (e.g. "House Sparrow (Passer domesticus)" contains "house sparrow")
  for (const entry of checklist) {
    const normCommon = normalizeSpeciesName(entry.commonName);
    if (normCommon && normalizedInput.includes(normCommon)) {
      return entry;
    }
    if (entry.scientificName) {
      const normSci = normalizeSpeciesName(entry.scientificName);
      if (normSci && normalizedInput.includes(normSci)) {
        return entry;
      }
    }
  }

  // 4. Reverse check: normalizedInput is contained in commonName (e.g. "Peafowl" -> "Indian Peafowl")
  // Only if normalizedInput is at least 5 chars to avoid over-matching short substrings
  if (normalizedInput.length >= 5) {
    for (const entry of checklist) {
      const normCommon = normalizeSpeciesName(entry.commonName);
      if (normCommon.includes(normalizedInput)) {
        return entry;
      }
    }
  }

  return null;
}

/**
 * Search checklist entries by common name, scientific name, or family.
 */
export function searchChecklist(
  query: string,
  entries: BirdChecklistEntry[]
): BirdChecklistEntry[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return entries;

  const terms = trimmed.split(/\s+/).filter(Boolean);

  return entries.filter((entry) => {
    const common = entry.commonName.toLowerCase();
    const scientific = (entry.scientificName || "").toLowerCase();
    const family = (entry.family || "").toLowerCase();

    return terms.every(
      (term) =>
        common.includes(term) ||
        scientific.includes(term) ||
        family.includes(term)
    );
  });
}

/**
 * Filter checklist entries by habitat.
 */
export function filterChecklistByHabitat(
  habitat: Habitat | "all",
  entries: BirdChecklistEntry[]
): BirdChecklistEntry[] {
  if (habitat === "all") return entries;
  return entries.filter((entry) => entry.habitats.includes(habitat));
}
