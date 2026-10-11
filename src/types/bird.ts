export interface BirdIdentification {
  species: string;
  confidence: string;
  description: string;
}

export interface IdentifyBirdSuccessResponse {
  success: true;
  result: BirdIdentification;
}

export interface IdentifyBirdErrorResponse {
  success: false;
  error: string;
}

export type IdentifyBirdResponse =
  | IdentifyBirdSuccessResponse
  | IdentifyBirdErrorResponse;

export type Habitat =
  | "woodland"
  | "wetland"
  | "grassland"
  | "urban"
  | "garden"
  | "farmland"
  | "coastal"
  | "other";

export type WeatherCondition =
  | "sunny"
  | "partly-cloudy"
  | "overcast"
  | "rainy"
  | "foggy";

export type ObservationTag =
  | "feeding"
  | "flying"
  | "perched"
  | "singing"
  | "calling"
  | "nesting"
  | "drinking"
  | "bathing"
  | "foraging"
  | "flocking";

/**
 * Represents a saved bird sighting in the local IndexedDB journal.
 * Image is optional for manual checklist field observations.
 */
export interface BirdSighting {
  id: string;
  species: string;
  description: string;
  confidence: string;
  image?: Blob;
  audio?: Blob;
  audioMimeType?: string;
  audioDurationMs?: number;
  habitat?: Habitat;
  weatherCondition?: WeatherCondition;
  tags?: ObservationTag[];
  createdAt: number; // Unix timestamp in milliseconds
}
