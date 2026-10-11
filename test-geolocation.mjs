import assert from "node:assert";

// Polyfill window, navigator & localStorage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.window = {
  localStorage: new LocalStorageMock(),
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
};

// Mock Navigator Geolocation
let activeWatcherCallback = null;
let clearedWatchId = null;

Object.defineProperty(globalThis.navigator, "geolocation", {
  value: {
    getCurrentPosition: (success) => {
      success({
        coords: {
          latitude: 23.7806,
          longitude: 85.3097,
          accuracy: 10,
        },
      });
    },
    watchPosition: (success) => {
      activeWatcherCallback = success;
      return 101; // watchId
    },
    clearWatch: (id) => {
      clearedWatchId = id;
      activeWatcherCallback = null;
    },
  },
  configurable: true,
});

const {
  calculateDistanceMeters,
  isGeolocationSupported,
  getCurrentLocation,
  startLocationTracking,
} = await import("./src/lib/geolocation.ts");

const {
  checkQuestCompletion,
  updateQuestDistance,
} = await import("./src/lib/quest-storage.ts");

console.log("1. Testing calculateDistanceMeters() with Haversine formula...");
const pointA = { latitude: 23.7806, longitude: 85.3097 };
const pointB = { latitude: 23.782, longitude: 85.313 };

// Zero distance for identical point
assert.strictEqual(calculateDistanceMeters(pointA, pointA), 0, "Distance to self should be 0");

// Haversine distance between 23.7806, 85.3097 and 23.7820, 85.3130 is ~371 meters
const distanceAB = calculateDistanceMeters(pointA, pointB);
assert.ok(
  distanceAB >= 360 && distanceAB <= 380,
  `Distance should be ~371m, got ${distanceAB}m`
);
console.log(`✓ Haversine distance calculation verified: ${distanceAB}m between points A and B`);

console.log("2. Testing isGeolocationSupported() & getCurrentLocation()...");
assert.strictEqual(isGeolocationSupported(), true);
const startCoords = await getCurrentLocation();
assert.strictEqual(startCoords.latitude, 23.7806);
assert.strictEqual(startCoords.longitude, 85.3097);
console.log("✓ Geolocation support and starting position capture verified");

console.log("3. Testing segment distance accumulation (A -> B -> C)...");
let accumulatedLogged = 0;
let lastSegment = 0;

const cleanupWatcher = startLocationTracking({
  initialAccumulatedMeters: 0,
  onMovement: (segment, total) => {
    lastSegment = segment;
    accumulatedLogged = total;
  },
  onStatusChange: (status) => {
    assert.strictEqual(status, "tracking");
  },
});

assert.ok(activeWatcherCallback, "watchPosition callback should be registered");

const t0 = Date.now();

// First reading (Point A baseline)
activeWatcherCallback({
  coords: { latitude: 23.7806, longitude: 85.3097, accuracy: 12 },
  timestamp: t0,
});
assert.strictEqual(accumulatedLogged, 0, "First position establishes baseline");

// Second reading: moved to Point B (~370m) after 60 seconds (realistic walking speed ~6.1 m/s)
activeWatcherCallback({
  coords: { latitude: 23.782, longitude: 85.313, accuracy: 15 },
  timestamp: t0 + 60000,
});
assert.strictEqual(lastSegment, distanceAB);
assert.strictEqual(accumulatedLogged, distanceAB);

// Third reading: moved to Point C (23.7840, 85.3160) after another 60 seconds
const pointC = { latitude: 23.784, longitude: 85.316 };
const distanceBC = calculateDistanceMeters(pointB, pointC);
activeWatcherCallback({
  coords: { latitude: pointC.latitude, longitude: pointC.longitude, accuracy: 10 },
  timestamp: t0 + 120000,
});
assert.strictEqual(lastSegment, distanceBC);
assert.strictEqual(accumulatedLogged, distanceAB + distanceBC);
console.log(`✓ Segment accumulation verified: total ${accumulatedLogged}m over multiple segments`);

console.log("4. Testing GPS noise / jitter filtering...");
const currentBeforeNoise = accumulatedLogged;

// Jitter reading: tiny jump of 2 meters (below MIN_MOVEMENT_THRESHOLD_METERS of 8m)
activeWatcherCallback({
  coords: { latitude: 23.78401, longitude: 85.31601, accuracy: 10 },
});
assert.strictEqual(
  accumulatedLogged,
  currentBeforeNoise,
  "Tiny GPS jitter (<8m) must be filtered out and not increase distance"
);
console.log("✓ Stationary GPS jitter (<8m) successfully filtered");

console.log("5. Testing poor accuracy rejection (accuracy > 100m)...");
activeWatcherCallback({
  coords: { latitude: 23.79, longitude: 85.32, accuracy: 350 }, // 350m inaccuracy
});
assert.strictEqual(
  accumulatedLogged,
  currentBeforeNoise,
  "Readings with poor accuracy (>100m) must be discarded"
);
console.log("✓ Inaccurate reading (>100m) successfully discarded");

console.log("6. Testing watcher cleanup (clearWatch)...");
cleanupWatcher();
assert.strictEqual(clearedWatchId, 101, "clearWatch must be invoked with watchId");
console.log("✓ clearWatch cleanup verified");

console.log("7. Testing Quest completion with GPS distance requirement...");
const mockQuest = {
  id: "quest_gps_test",
  title: "30-Minute Outdoor Quest",
  durationMinutes: 30,
  targetBirds: 2,
  distanceTargetMeters: 1000,
  tasks: [
    { id: "task_1", text: "Find 2 birds", isCompleted: true, type: "discovery" },
    { id: "task_2", text: "Photograph 1 bird", isCompleted: true, type: "photo" },
  ],
  createdAt: Date.now(),
};

let progress = {
  questId: mockQuest.id,
  discoveredSpecies: ["Robin", "Jay"],
  photosCaptured: 2,
  completedTaskIds: ["task_1", "task_2"],
  distanceWalkedMeters: 600, // Only 600m walked, target is 1000m
  locationStatus: "tracking",
  isCompleted: false,
};

// With tracking active and distance < target: not complete
assert.strictEqual(
  checkQuestCompletion(mockQuest, progress),
  false,
  "Quest should not complete if distance target is unmet while tracking"
);

// When distance reaches target (1050m)
progress = updateQuestDistance(1050, "tracking", mockQuest, progress);
assert.strictEqual(
  progress.isCompleted,
  true,
  "Quest should complete once distance target is reached"
);
console.log("✓ GPS distance requirement correctly enforces quest completion");

console.log("8. Testing fallback when GPS permission is denied...");
const deniedProgress = {
  ...progress,
  distanceWalkedMeters: 0,
  locationStatus: "denied", // Permission was denied
  isCompleted: false,
};

// When GPS is denied, user is not blocked from completing manual quest
assert.strictEqual(
  checkQuestCompletion(mockQuest, deniedProgress),
  true,
  "Quest should complete if GPS is denied/unavailable without blocking user"
);
console.log("✓ Fallback when GPS is denied verified (no soft lock)");

console.log("\nALL GPS OUTDOOR VALIDATION TESTS PASSED! 📍🌿🚶");
