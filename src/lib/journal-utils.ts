import { BirdSighting } from "@/types/bird";

export type ConfidenceFilterOption = "all" | "high" | "medium" | "low";
export type DateFilterOption = "all" | "today" | "7days" | "30days";

export interface JournalFilters {
  searchQuery: string;
  confidence: ConfidenceFilterOption;
  dateRange: DateFilterOption;
}

export interface JournalStats {
  totalObservations: number;
  uniqueSpeciesCount: number;
  highConfidenceCount: number;
}

/**
 * Normalizes a bird species name for deterministic unique counting.
 * Strips scientific names in parentheses and normalizes casing/whitespace.
 *
 * Example:
 * "House Sparrow" -> "house sparrow"
 * "HOUSE SPARROW" -> "house sparrow"
 * "Northern Cardinal (Cardinalis cardinalis)" -> "northern cardinal"
 */
export function normalizeSpeciesName(species: string): string {
  if (!species) return "";
  const cleaned = species.trim();
  const commonPart = cleaned.split("(")[0].trim().toLowerCase();
  // Collapse consecutive whitespaces
  return (commonPart || cleaned.toLowerCase()).replace(/\s+/g, " ");
}

/**
 * Normalizes qualitative confidence string into high / medium / low.
 */
export function classifyConfidence(confidence: string): "high" | "medium" | "low" {
  if (!confidence) return "medium";
  const lower = confidence.toLowerCase().trim();

  // Check low / uncertain / unlikely first to prevent substrings (e.g. 'unlikely' contains 'likely')
  if (
    lower.includes("low") ||
    lower.includes("uncertain") ||
    lower.includes("unlikely")
  ) {
    return "low";
  }

  if (
    lower.includes("high") ||
    lower.includes("likely") ||
    lower.includes("certain")
  ) {
    return "high";
  }

  return "medium";
}

/**
 * Checks if a timestamp falls within a chosen date range filter.
 * Uses local time boundaries for "today".
 */
export function isDateInRange(
  timestamp: number,
  dateRange: DateFilterOption,
  now?: number
): boolean {
  if (dateRange === "all") return true;
  if (now === undefined) return true;

  const nowDate = new Date(now);

  if (dateRange === "today") {
    // Start of current day in local time
    const startOfToday = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth(),
      nowDate.getDate()
    ).getTime();
    return timestamp >= startOfToday && timestamp <= now + 60000;
  }

  if (dateRange === "7days") {
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    return timestamp >= sevenDaysAgo && timestamp <= now + 60000;
  }

  if (dateRange === "30days") {
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    return timestamp >= thirtyDaysAgo && timestamp <= now + 60000;
  }

  return true;
}

/**
 * Checks whether an observation matches the search query.
 * Matches against common bird name, scientific name (if in species), or description.
 * Case-insensitive, whitespace-tolerant.
 */
export function matchesSearch(
  sighting: BirdSighting,
  rawQuery: string
): boolean {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, " ");
  if (!query) return true;

  const species = (sighting.species || "").toLowerCase();
  const description = (sighting.description || "").toLowerCase();

  // Direct substring match on species or description
  if (species.includes(query) || description.includes(query)) {
    return true;
  }

  // Multi-term matching: every word in the search query must appear in species or description
  const queryWords = query.split(" ").filter(Boolean);
  if (queryWords.length > 1) {
    const combined = `${species} ${description}`;
    return queryWords.every((word) => combined.includes(word));
  }

  return false;
}

/**
 * Pure filter function applying search, confidence, and date filters simultaneously.
 */
export function filterSightings<T extends BirdSighting>(
  sightings: T[],
  filters: JournalFilters,
  now?: number
): T[] {
  return sightings.filter((sighting) => {
    // 1. Search matching
    if (!matchesSearch(sighting, filters.searchQuery)) {
      return false;
    }

    // 2. Confidence matching
    if (filters.confidence !== "all") {
      const level = classifyConfidence(sighting.confidence);
      if (level !== filters.confidence) {
        return false;
      }
    }

    // 3. Date matching
    if (!isDateInRange(sighting.createdAt, filters.dateRange, now)) {
      return false;
    }

    return true;
  });
}

/**
 * Computes deterministic statistics for the bird journal:
 * - Total observations
 * - Unique species count (normalized)
 * - High confidence observations count
 */
export function calculateJournalStats(sightings: BirdSighting[]): JournalStats {
  const uniqueSpeciesSet = new Set<string>();
  let highConfidenceCount = 0;

  for (const s of sightings) {
    const normalized = normalizeSpeciesName(s.species);
    if (normalized) {
      uniqueSpeciesSet.add(normalized);
    }

    if (classifyConfidence(s.confidence) === "high") {
      highConfidenceCount++;
    }
  }

  return {
    totalObservations: sightings.length,
    uniqueSpeciesCount: uniqueSpeciesSet.size,
    highConfidenceCount,
  };
}
