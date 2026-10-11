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

/**
 * Represents a saved bird sighting in the local IndexedDB journal.
 */
export interface BirdSighting {
  id: string;
  species: string;
  description: string;
  confidence: string;
  image: Blob;
  createdAt: number; // Unix timestamp in milliseconds
}
