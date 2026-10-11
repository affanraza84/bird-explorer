import { GeoCoordinates, LocationTrackingStatus } from "@/types/quest";

// Earth's mean radius in meters
const EARTH_RADIUS_METERS = 6371000;

// Maximum acceptable GPS accuracy (in meters). Readings with accuracy worse than this are filtered out.
export const MAX_ACCURACY_THRESHOLD_METERS = 100;

// Minimum movement delta to distinguish real walking from stationary GPS noise/jitter
export const MIN_MOVEMENT_THRESHOLD_METERS = 8;

// Maximum realistic walking/running speed (in meters/sec ~25 km/h). Filters out sudden GPS teleport jumps.
export const MAX_REALISTIC_SPEED_MPS = 7;

/**
 * Calculates the great-circle distance between two geographic coordinates on Earth using the Haversine formula.
 * Formula:
 * a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
 * c = 2 * atan2(√a, √(1-a))
 * distance = R * c
 */
export function calculateDistanceMeters(
  pointA: GeoCoordinates,
  pointB: GeoCoordinates
): number {
  if (
    pointA.latitude === pointB.latitude &&
    pointA.longitude === pointB.longitude
  ) {
    return 0;
  }

  const toRad = (degree: number) => (degree * Math.PI) / 180;

  const lat1Rad = toRad(pointA.latitude);
  const lat2Rad = toRad(pointB.latitude);
  const deltaLatRad = toRad(pointB.latitude - pointA.latitude);
  const deltaLonRad = toRad(pointB.longitude - pointA.longitude);

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLonRad / 2) *
      Math.sin(deltaLonRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Checks if the browser environment supports the Geolocation API.
 */
export function isGeolocationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "geolocation" in navigator
  );
}

/**
 * Requests the single current position to verify permission and acquire a starting point.
 */
export function getCurrentLocation(): Promise<GeoCoordinates> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  });
}

export interface LocationTrackingCallbacks {
  onMovement: (segmentMeters: number, totalAccumulated: number) => void;
  onStatusChange: (status: LocationTrackingStatus, message?: string) => void;
  initialAccumulatedMeters?: number;
}

/**
 * Starts continuous, privacy-first outdoor movement tracking using navigator.geolocation.watchPosition().
 * - Coordinates are kept in transient memory ONLY.
 * - Exact coordinates are NEVER persisted to localStorage or sent to any server.
 * - Filters out GPS jitter and poor-accuracy readings.
 * - Returns a cleanup function that invokes navigator.geolocation.clearWatch().
 */
export function startLocationTracking(
  callbacks: LocationTrackingCallbacks
): () => void {
  if (!isGeolocationSupported()) {
    callbacks.onStatusChange("unsupported", "Browser geolocation is not supported.");
    return () => {};
  }

  let previousPoint: GeoCoordinates | null = null;
  let previousTimestamp = Date.now();
  let accumulatedDistance = callbacks.initialAccumulatedMeters || 0;

  callbacks.onStatusChange("tracking");

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const accuracy = position.coords.accuracy;
      const currentPoint: GeoCoordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      const posTimestamp = position.timestamp || Date.now();

      // Filter 1: Discard readings with poor accuracy (> 100 meters)
      if (typeof accuracy === "number" && accuracy > MAX_ACCURACY_THRESHOLD_METERS) {
        return;
      }

      if (previousPoint) {
        const segmentMeters = calculateDistanceMeters(previousPoint, currentPoint);
        const timeElapsedSeconds = Math.max(
          1,
          (posTimestamp - previousTimestamp) / 1000
        );
        const speedMps = segmentMeters / timeElapsedSeconds;

        // Filter 2: Ignore GPS jitter (movement less than minimum threshold)
        if (segmentMeters < MIN_MOVEMENT_THRESHOLD_METERS) {
          return;
        }

        // Filter 3: Discard teleportation / anomalous jumps (> 25 m/s ~ 90 km/h)
        if (speedMps > 25) {
          return;
        }

        accumulatedDistance += segmentMeters;
        callbacks.onMovement(segmentMeters, accumulatedDistance);
      }

      previousPoint = currentPoint;
      previousTimestamp = posTimestamp;
      callbacks.onStatusChange("tracking");
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        callbacks.onStatusChange("denied", "Location permission was denied.");
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        callbacks.onStatusChange("unavailable", "GPS signal is currently unavailable.");
      } else {
        callbacks.onStatusChange("error", err.message || "GPS tracking error occurred.");
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 5000,
    }
  );

  // Return unsubscribe/cleanup function
  return () => {
    try {
      navigator.geolocation.clearWatch(watchId);
    } catch {
      // Ignore cleanup error
    }
  };
}
