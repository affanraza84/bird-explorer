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
