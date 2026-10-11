import "fake-indexeddb/auto";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

// Polyfill window for node test environment
globalThis.window = globalThis;

console.log("=== MILESTONE 6: PWA & AUDIO FIELD NOTES TESTS ===\n");

// ---------------------------------------------------------
// 1. Audio Recording Utility & Constants Validation
// ---------------------------------------------------------
console.log("1. Testing Audio Constants & MIME Type detection...");
const { MAX_AUDIO_DURATION_SECONDS, getSupportedAudioMimeType } = await import(
  "./src/lib/audio-recorder.ts"
);

assert.strictEqual(MAX_AUDIO_DURATION_SECONDS, 60, "Maximum audio duration must be 60 seconds");
const defaultMime = getSupportedAudioMimeType();
assert.ok(typeof defaultMime === "string", "Supported MIME type should return a string");
console.log("✓ Audio recording limit verified: 60s max, MIME detection functional");

// ---------------------------------------------------------
// 2. IndexedDB Migration & Audio Field Persistence
// ---------------------------------------------------------
console.log("2. Testing IndexedDB Audio Field Persistence & v1 -> v2 Migration...");
const {
  saveSighting,
  getSightings,
  getSightingById,
  attachAudioToSighting,
  removeAudioFromSighting,
  clearSightings,
} = await import("./src/lib/bird-journal.ts");

// Start with clean DB
await clearSightings();

// Sighting without audio (backward compatibility test)
const imageBlob1 = new Blob(["image-bytes-cardinal"], { type: "image/jpeg" });
const sightingWithoutAudio = await saveSighting({
  species: "Northern Cardinal",
  confidence: "High",
  description: "Red bird in pine tree.",
  image: imageBlob1,
});

assert.ok(sightingWithoutAudio.id);
assert.strictEqual(sightingWithoutAudio.audio, undefined, "audio field should be undefined when omitted");
assert.strictEqual(sightingWithoutAudio.audioMimeType, undefined);
assert.strictEqual(sightingWithoutAudio.audioDurationMs, undefined);
console.log("✓ Sighting without audio saved successfully (backward compatibility intact)");

// Sighting with audio note
const imageBlob2 = new Blob(["image-bytes-sparrow"], { type: "image/jpeg" });
const audioBlob2 = new Blob(["audio-bytes-chirp"], { type: "audio/webm" });
const sightingWithAudio = await saveSighting({
  species: "Song Sparrow",
  confidence: "Likely species",
  description: "Singing melodiously from perch.",
  image: imageBlob2,
  audio: audioBlob2,
  audioMimeType: "audio/webm",
  audioDurationMs: 14500,
});

assert.ok(sightingWithAudio.id);
assert.ok(sightingWithAudio.audio instanceof Blob, "Audio should be saved as a Blob");
assert.strictEqual(sightingWithAudio.audioMimeType, "audio/webm");
assert.strictEqual(sightingWithAudio.audioDurationMs, 14500);
console.log("✓ Sighting with audio note saved successfully with Blob, MIME type, and duration");

// Retrieve all sightings from IndexedDB and verify data integrity
const allSightings = await getSightings();
assert.strictEqual(allSightings.length, 2, "Should retrieve 2 sightings");

const retrievedWithAudio = allSightings.find((s) => s.id === sightingWithAudio.id);
assert.ok(retrievedWithAudio);
assert.ok(retrievedWithAudio.audio instanceof Blob, "Retrieved audio must be a valid Blob");
assert.strictEqual(retrievedWithAudio.audioMimeType, "audio/webm");
assert.strictEqual(retrievedWithAudio.audioDurationMs, 14500);

const retrievedWithoutAudio = allSightings.find((s) => s.id === sightingWithoutAudio.id);
assert.ok(retrievedWithoutAudio);
assert.strictEqual(retrievedWithoutAudio.audio, undefined, "Old sightings without audio must load cleanly");
console.log("✓ IndexedDB query preserves audio Blob integrity alongside non-audio entries");

// ---------------------------------------------------------
// 3. Attaching Audio to an Existing Sighting
// ---------------------------------------------------------
console.log("3. Testing attachAudioToSighting() and removeAudioFromSighting()...");
const newlyRecordedAudio = new Blob(["newly-recorded-audio-bytes"], { type: "audio/webm" });
const updatedSighting = await attachAudioToSighting(
  sightingWithoutAudio.id,
  newlyRecordedAudio,
  22000,
  "audio/webm"
);

assert.ok(updatedSighting.audio instanceof Blob);
assert.strictEqual(updatedSighting.audioDurationMs, 22000);
assert.strictEqual(updatedSighting.audioMimeType, "audio/webm");

// Verify in DB via getSightingById
const fetchedAfterAttach = await getSightingById(sightingWithoutAudio.id);
assert.ok(fetchedAfterAttach?.audio instanceof Blob);
assert.strictEqual(fetchedAfterAttach?.audioDurationMs, 22000);
console.log("✓ attachAudioToSighting() attached audio note to existing observation in IndexedDB");

// Remove audio
const clearedAudioSighting = await removeAudioFromSighting(sightingWithoutAudio.id);
assert.strictEqual(clearedAudioSighting.audio, undefined);
assert.strictEqual(clearedAudioSighting.audioDurationMs, undefined);

const fetchedAfterRemove = await getSightingById(sightingWithoutAudio.id);
assert.strictEqual(fetchedAfterRemove?.audio, undefined);
console.log("✓ removeAudioFromSighting() successfully removed audio note while preserving sighting");

// Error handling validation
try {
  await attachAudioToSighting("non-existent-id", newlyRecordedAudio, 5000);
  assert.fail("Should throw when attaching to non-existent ID");
} catch (err) {
  assert.match(err.message, /not found/i);
  console.log("✓ Caught expected error for non-existent sighting ID");
}

try {
  await attachAudioToSighting(sightingWithAudio.id, null, 5000);
  assert.fail("Should throw when audio is not a valid Blob");
} catch (err) {
  assert.match(err.message, /valid audio Blob is required/i);
  console.log("✓ Caught expected error for invalid audio Blob");
}

// ---------------------------------------------------------
// 4. JSON & CSV Export with Audio Fields
// ---------------------------------------------------------
console.log("4. Testing JSON & CSV Export with Audio Notes...");
const { prepareJournalJson, generateJournalCsv } = await import(
  "./src/lib/journal-export.ts"
);

const exportData = [retrievedWithAudio, retrievedWithoutAudio];

// JSON Export Verification
const jsonItems = await prepareJournalJson(exportData);
assert.strictEqual(jsonItems.length, 2);

const itemWithAudio = jsonItems.find((i) => i.id === retrievedWithAudio.id);
assert.ok(itemWithAudio);
assert.ok(
  itemWithAudio.audio?.startsWith("data:audio/webm;base64,"),
  "JSON export must serialize audio Blob into Base64 Data URL"
);
assert.strictEqual(itemWithAudio.audioMimeType, "audio/webm");
assert.strictEqual(itemWithAudio.audioDurationMs, 14500);

const itemWithoutAudio = jsonItems.find((i) => i.id === retrievedWithoutAudio.id);
assert.ok(itemWithoutAudio);
assert.strictEqual(itemWithoutAudio.audio, undefined, "JSON export must omit audio field when absent");
assert.strictEqual(itemWithoutAudio.audioMimeType, undefined);
assert.strictEqual(itemWithoutAudio.audioDurationMs, undefined);
console.log("✓ JSON Export correctly includes base64 audio when present and cleanly omits when absent");

// CSV Export Verification
const csvText = generateJournalCsv(exportData);
assert.ok(
  csvText.startsWith("id,species,confidence,description,createdAt,hasAudio,audioDurationMs"),
  "CSV header must contain hasAudio and audioDurationMs columns"
);
assert.ok(!csvText.includes("[object Blob]"), "CSV must never contain raw binary blob text");
assert.ok(csvText.includes("true,14500"), "CSV row with audio must have hasAudio=true and duration");
assert.ok(csvText.includes("false,"), "CSV row without audio must have hasAudio=false");
console.log("✓ CSV Export correctly contains metadata-only columns (hasAudio, audioDurationMs) with no binary data");

// ---------------------------------------------------------
// 5. PWA Manifest & Service Worker Static File Validation
// ---------------------------------------------------------
console.log("5. Testing PWA Manifest & Service Worker File Structure...");
const manifestPath = path.resolve("./public/manifest.json");
assert.ok(fs.existsSync(manifestPath), "public/manifest.json must exist");
const manifestContent = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

assert.strictEqual(manifestContent.name, "Bird Explorer");
assert.strictEqual(manifestContent.short_name, "Bird Explorer");
assert.strictEqual(manifestContent.display, "standalone");
assert.strictEqual(manifestContent.start_url, "/");
assert.strictEqual(manifestContent.orientation, "portrait");
assert.ok(Array.isArray(manifestContent.icons) && manifestContent.icons.length >= 2);
console.log("✓ PWA Manifest matches specifications (standalone, portrait, name, icons)");

const swPath = path.resolve("./public/sw.js");
assert.ok(fs.existsSync(swPath), "public/sw.js must exist");
const swContent = fs.readFileSync(swPath, "utf-8");

assert.ok(swContent.includes('CACHE_NAME = "bird-explorer-v1"'), "SW must declare cache version");
assert.ok(swContent.includes('pathname.startsWith("/api/")'), "SW must explicitly handle /api/ requests");
assert.ok(swContent.includes("navigate"), "SW must handle navigation requests with offline shell fallback");
console.log("✓ Service Worker script verified (precache, offline navigation fallback, /api/ bypass)");

// Verify icon files exist in public/
assert.ok(fs.existsSync("./public/icon.svg"), "public/icon.svg must exist");
assert.ok(fs.existsSync("./public/icon-192.png"), "public/icon-192.png must exist");
assert.ok(fs.existsSync("./public/icon-512.png"), "public/icon-512.png must exist");
console.log("✓ All PWA icon assets (icon.svg, icon-192.png, icon-512.png) exist");

console.log("\nALL MILESTONE 6 TESTS PASSED SUCCESSFULLY! 🎙️📱🕊️");
