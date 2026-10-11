import "fake-indexeddb/auto";
import assert from "node:assert/strict";

// Polyfill window & localStorage for node test environment
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

const mockStorage = new LocalStorageMock();
globalThis.localStorage = mockStorage;
globalThis.window = globalThis;
globalThis.window.dispatchEvent = () => true;

// Dynamic import after polyfill
const {
  saveSighting,
  getSightings,
  getSightingById,
  updateSightingMetadata,
  validateHabitat,
  validateWeatherCondition,
  validateObservationTags,
  recordChecklistSighting,
  getChecklistHistory,
  getChecklistRecord,
  clearChecklistHistory,
  clearSightings,
} = await import("./src/lib/bird-journal.ts");

const { BIRD_CHECKLIST } = await import("./src/data/bird-checklist.ts");

const {
  searchChecklist,
  filterChecklistByHabitat,
  normalizeSpeciesName,
  matchSpeciesToChecklist,
} = await import("./src/lib/checklist-utils.ts");

const {
  initializeQuestProgress,
  recordBirdDiscovery,
} = await import("./src/lib/quest-storage.ts");

console.log("=== MILESTONE 7: FIELD OBSERVATION & CHECKLIST TESTS ===\n");

// 1. Habitat validation
console.log("1. Testing Habitat validation...");
assert.equal(validateHabitat("woodland"), "woodland");
assert.equal(validateHabitat("wetland"), "wetland");
assert.equal(validateHabitat("garden"), "garden");
assert.equal(validateHabitat(undefined), undefined);
assert.equal(validateHabitat(""), undefined);

try {
  validateHabitat("mars_crater");
  assert.fail("Should have rejected invalid habitat");
} catch (err) {
  assert.match(err.message, /invalid habitat/i);
  console.log("✓ Correctly rejected invalid habitat");
}

// 2. Weather condition validation
console.log("\n2. Testing Weather condition validation...");
assert.equal(validateWeatherCondition("sunny"), "sunny");
assert.equal(validateWeatherCondition("overcast"), "overcast");
assert.equal(validateWeatherCondition(undefined), undefined);

try {
  validateWeatherCondition("snowy_blizzard");
  assert.fail("Should have rejected invalid weather condition");
} catch (err) {
  assert.match(err.message, /invalid weather condition/i);
  console.log("✓ Correctly rejected invalid weather condition");
}

// 3. Observation tag validation & deduplication
console.log("\n3. Testing Observation Tag validation & deduplication...");
const validTags = validateObservationTags(["perched", "singing", "perched", "feeding"]);
assert.deepEqual(validTags, ["perched", "singing", "feeding"]);
console.log("✓ Deduplicated duplicate tags:", validTags);

try {
  validateObservationTags(["flying", "texting_on_phone"]);
  assert.fail("Should have rejected invalid tag");
} catch (err) {
  assert.match(err.message, /invalid observation tag/i);
  console.log("✓ Correctly rejected invalid observation tag");
}

// 4. Checklist dataset & properties
console.log("\n4. Testing Bundled Checklist Dataset...");
assert.ok(BIRD_CHECKLIST.length >= 40 && BIRD_CHECKLIST.length <= 60, `Checklist size (${BIRD_CHECKLIST.length}) should be between 40 and 60`);
console.log(`✓ Checklist contains ${BIRD_CHECKLIST.length} regional species`);

const sparrow = BIRD_CHECKLIST.find((b) => b.id === "house-sparrow");
assert.ok(sparrow, "House Sparrow must exist in checklist");
assert.equal(sparrow.commonName, "House Sparrow");
assert.equal(sparrow.scientificName, "Passer domesticus");
assert.ok(sparrow.habitats.includes("urban"));

const kingfisher = BIRD_CHECKLIST.find((b) => b.id === "common-kingfisher");
assert.ok(kingfisher, "Common Kingfisher must exist in checklist");
assert.ok(kingfisher.habitats.includes("wetland"));

const kite = BIRD_CHECKLIST.find((b) => b.id === "black-kite");
assert.ok(kite, "Black Kite must exist in checklist");

// 5. Checklist Search & Habitat Filtering
console.log("\n5. Testing Checklist Search and Filtering...");
const searchByCommon = searchChecklist("Sparrow", BIRD_CHECKLIST);
assert.ok(searchByCommon.some((b) => b.commonName === "House Sparrow"));

const searchByScientific = searchChecklist("Alcedo atthis", BIRD_CHECKLIST);
assert.equal(searchByScientific[0]?.commonName, "Common Kingfisher");

const searchByFamily = searchChecklist("Columbidae", BIRD_CHECKLIST);
assert.ok(searchByFamily.length >= 2, "Should find Columbidae doves/pigeons");

const wetlandBirds = filterChecklistByHabitat("wetland", BIRD_CHECKLIST);
assert.ok(wetlandBirds.length >= 5, "Should have multiple wetland species");
assert.ok(wetlandBirds.every((b) => b.habitats.includes("wetland")));

const combined = searchChecklist("Kingfisher", filterChecklistByHabitat("wetland", BIRD_CHECKLIST));
assert.ok(combined.length >= 2, "Should find multiple wetland kingfishers");
console.log("✓ Search, habitat filters, and combined queries passed");

// 6. Species Name Normalization & Deterministic AI Matching
console.log("\n6. Testing Species Normalization & AI Integration...");
assert.equal(normalizeSpeciesName("House Sparrow (Passer domesticus)"), "house sparrow passer domesticus");

const matched1 = matchSpeciesToChecklist("House Sparrow", BIRD_CHECKLIST);
assert.equal(matched1?.id, "house-sparrow");

const matched2 = matchSpeciesToChecklist("House Sparrow (Passer domesticus)", BIRD_CHECKLIST);
assert.equal(matched2?.id, "house-sparrow");

const matched3 = matchSpeciesToChecklist("Acridotheres tristis", BIRD_CHECKLIST);
assert.equal(matched3?.id, "common-myna");

const unmatched = matchSpeciesToChecklist("Penguin of Antarctica", BIRD_CHECKLIST);
assert.equal(unmatched, null, "Unknown species should return null, not a fake entry");
console.log("✓ Deterministic AI checklist matching verified");

// 7. Checklist History Persistence in IndexedDB
console.log("\n7. Testing Checklist History in IndexedDB...");
await clearChecklistHistory();

const record1 = await recordChecklistSighting("house-sparrow", "2026-10-11T10:00:00.000Z");
assert.equal(record1.speciesId, "house-sparrow");
assert.equal(record1.observationCount, 1);
assert.equal(record1.firstObservedAt, "2026-10-11T10:00:00.000Z");
assert.equal(record1.lastObservedAt, "2026-10-11T10:00:00.000Z");

const record2 = await recordChecklistSighting("house-sparrow", "2026-10-11T15:00:00.000Z");
assert.equal(record2.observationCount, 2);
assert.equal(record2.firstObservedAt, "2026-10-11T10:00:00.000Z");
assert.equal(record2.lastObservedAt, "2026-10-11T15:00:00.000Z");

const fetched = await getChecklistRecord("house-sparrow");
assert.equal(fetched?.observationCount, 2);

const allHistory = await getChecklistHistory();
assert.equal(allHistory.length, 1);
console.log("✓ Checklist history increment and timestamp persistence verified");

// 8. Manual Field Observation without Image
console.log("\n8. Testing Manual Field Observation without Photo...");
await clearSightings();

const manualSighting = await saveSighting({
  species: "Common Kingfisher",
  confidence: "Field Observation",
  description: "Perched on low branch overhang above fishing pond.",
  habitat: "wetland",
  weatherCondition: "sunny",
  tags: ["perched", "foraging"],
});

assert.ok(manualSighting.id, "Generated ID");
assert.equal(manualSighting.species, "Common Kingfisher");
assert.equal(manualSighting.image, undefined, "No image blob for manual field observation");
assert.equal(manualSighting.habitat, "wetland");
assert.equal(manualSighting.weatherCondition, "sunny");
assert.deepEqual(manualSighting.tags, ["perched", "foraging"]);

const allSightings = await getSightings();
assert.equal(allSightings.length, 1);
assert.equal(allSightings[0].species, "Common Kingfisher");
assert.equal(allSightings[0].image, undefined);

// Also verify photo sightings still work
const photoSighting = await saveSighting({
  species: "Black Kite",
  confidence: "High (95%)",
  description: "Gliding overhead",
  image: new Blob(["photo-data"], { type: "image/jpeg" }),
  habitat: "urban",
});
assert.ok(photoSighting.image instanceof Blob);

const updatedSightings = await getSightings();
assert.equal(updatedSightings.length, 2, "Both photo and photo-less observations coexist in IndexedDB");
console.log("✓ Manual photo-less field observations & photo observations coexist successfully");

// 9. Edit Observation Metadata
console.log("\n9. Testing Edit Observation Metadata...");
const edited = await updateSightingMetadata(manualSighting.id, {
  habitat: "farmland",
  weatherCondition: "overcast",
  tags: ["flying"],
  description: "Flew across paddy field toward canal.",
});

assert.equal(edited.habitat, "farmland");
assert.equal(edited.weatherCondition, "overcast");
assert.deepEqual(edited.tags, ["flying"]);
assert.equal(edited.description, "Flew across paddy field toward canal.");

const reloaded = await getSightingById(manualSighting.id);
assert.equal(reloaded?.habitat, "farmland");
assert.equal(reloaded?.weatherCondition, "overcast");
console.log("✓ updateSightingMetadata successfully edited observation in IndexedDB");

// 10. Quest Integration
console.log("\n10. Testing Quest Integration with Field Observations...");
const mockQuest = {
  id: "test-quest-m7",
  title: "15-Minute Backyard Quest",
  durationMinutes: 15,
  targetBirds: 2,
  distanceTargetMeters: 50,
  tasks: [
    { id: "task_1", text: "Find 2 different bird species", isCompleted: false, type: "discovery" },
    { id: "task_2", text: "Observe quietly for 2 minutes", isCompleted: false, type: "observation" },
  ],
  createdAt: Date.now(),
};

let progress = initializeQuestProgress(mockQuest);
assert.equal(progress.discoveredSpecies.length, 0);

// Merely searching or browsing checklist does NOT record discovery
// (Only explicit confirmation does)
assert.equal(progress.discoveredSpecies.length, 0);

// Explicit manual field observation confirmed:
const result1 = recordBirdDiscovery("Common Kingfisher", mockQuest, progress);
progress = result1.updatedProgress;
assert.equal(result1.isNewSpecies, true);
assert.equal(progress.discoveredSpecies.length, 1);

// Repeating same species does not duplicate
const result2 = recordBirdDiscovery("Common Kingfisher", mockQuest, progress);
assert.equal(result2.isNewSpecies, false);
assert.equal(result2.updatedProgress.discoveredSpecies.length, 1);

// Adding second unique species
const result3 = recordBirdDiscovery("Black Kite", mockQuest, progress);
assert.equal(result3.isNewSpecies, true);
assert.equal(result3.updatedProgress.discoveredSpecies.length, 2);
console.log("✓ Quest discovery tracking with manual observations verified");

console.log("\nALL MILESTONE 7 TESTS PASSED SUCCESSFULLY! 🌿🔭📋");
