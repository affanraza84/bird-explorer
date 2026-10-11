import { Habitat } from "./bird";

export interface BirdChecklistEntry {
  id: string;
  commonName: string;
  scientificName?: string;
  family?: string;
  habitats: Habitat[];
  description?: string;
  region?: string[];
}

export interface ChecklistObservationRecord {
  speciesId: string;
  firstObservedAt: string;
  lastObservedAt: string;
  observationCount: number;
}
