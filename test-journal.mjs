import "fake-indexeddb/auto";
import assert from "node:assert";

// Polyfill window for node test environment
globalThis.window = globalThis;

// Import our bird-journal library
const {
  saveSighting,
  getSightings,
  deleteSighting,
  clearSightings,
  isIndexedDBAvailable,
} = await import("./src/lib/bird-journal.ts");

console.log("1. Testing isIndexedDBAvailable()...");
assert.strictEqual(isIndexedDBAvailable(), true, "IndexedDB should be detected as available");
console.log("✓ isIndexedDBAvailable() passed");

console.log("2. Testing initial getSightings() on empty DB...");
const initialList = await getSightings();
assert.strictEqual(initialList.length, 0, "Initial sightings should be empty");
console.log("✓ Initial empty list verified");

console.log("3. Testing saveSighting()...");
const testBlob1 = new Blob(["test-image-content-1"], { type: "image/jpeg" });
const sighting1 = await saveSighting({
  species: "Northern Cardinal (Cardinalis cardinalis)",
  confidence: "Possible match",
  description: "Bright red crest, stout beak.",
  image: testBlob1,
});

assert.ok(sighting1.id, "Sighting should have an ID generated");
assert.strictEqual(sighting1.species, "Northern Cardinal (Cardinalis cardinalis)");
assert.strictEqual(sighting1.confidence, "Possible match");
assert.ok(sighting1.createdAt > 0, "CreatedAt timestamp should be populated");
console.log("✓ Sighting 1 successfully saved with id:", sighting1.id);

console.log("4. Testing getSightings() after save...");
const listAfterOne = await getSightings();
assert.strictEqual(listAfterOne.length, 1);
assert.strictEqual(listAfterOne[0].id, sighting1.id);
assert.strictEqual(listAfterOne[0].species, sighting1.species);
assert.ok(listAfterOne[0].image instanceof Blob, "Stored image must be a Blob instance");
console.log("✓ Sighting retrieval and Blob integrity verified");

console.log("5. Testing multiple sightings and newest-first sorting...");
await new Promise((r) => setTimeout(r, 15));
const testBlob2 = new Blob(["test-image-content-2"], { type: "image/png" });
const sighting2 = await saveSighting({
  species: "Blue Jay (Cyanocitta cristata)",
  confidence: "Likely species",
  description: "Vibrant blue crest and black collar.",
  image: testBlob2,
});

const listAfterTwo = await getSightings();
assert.strictEqual(listAfterTwo.length, 2);
assert.strictEqual(listAfterTwo[0].id, sighting2.id, "Newest sighting should be first");
assert.strictEqual(listAfterTwo[1].id, sighting1.id, "Older sighting should be second");
console.log("✓ Multiple sightings sorted newest-first verified");

console.log("6. Testing deleteSighting()...");
await deleteSighting(sighting1.id);
const listAfterDelete = await getSightings();
assert.strictEqual(listAfterDelete.length, 1);
assert.strictEqual(listAfterDelete[0].id, sighting2.id);
console.log("✓ Deletion of single sighting verified");

console.log("7. Testing clearSightings()...");
await clearSightings();
const listAfterClear = await getSightings();
assert.strictEqual(listAfterClear.length, 0);
console.log("✓ clearSightings() verified");

console.log("8. Testing validation & error handling...");
try {
  await saveSighting({
    species: "",
    confidence: "Uncertain",
    description: "",
    image: testBlob1,
  });
  assert.fail("Should have thrown error for empty species");
} catch (err) {
  assert.match(err.message, /species name is missing/i);
  console.log("✓ Caught expected validation error for empty species:", err.message);
}

try {
  await saveSighting({
    species: "Robin",
    confidence: "Likely",
    description: "Orange breast",
    image: null,
  });
  assert.fail("Should have thrown error for missing image blob");
} catch (err) {
  assert.match(err.message, /valid image blob is required/i);
  console.log("✓ Caught expected validation error for missing image blob:", err.message);
}

console.log("\nALL INDEXEDDB TESTS PASSED SUCCESSFULLY! 🎉");
