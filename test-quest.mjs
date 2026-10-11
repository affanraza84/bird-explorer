import assert from "node:assert";

// Polyfill window & localStorage for Node environment test
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

const {
  normalizeSpeciesName,
  initializeQuestProgress,
  recordBirdDiscovery,
  toggleTaskCompletion,
  checkQuestCompletion,
  saveActiveQuest,
  loadActiveQuest,
  clearActiveQuest,
} = await import("./src/lib/quest-storage.ts");

console.log("1. Testing normalizeSpeciesName()...");
assert.strictEqual(
  normalizeSpeciesName("Northern Cardinal (Cardinalis cardinalis)"),
  "northern cardinal"
);
assert.strictEqual(normalizeSpeciesName("Common Myna"), "common myna");
assert.strictEqual(normalizeSpeciesName("  Blue Jay  (Cyanocitta cristata) "), "blue jay");
console.log("✓ normalizeSpeciesName passed");

console.log("2. Testing Quest initialization...");
const mockQuest = {
  id: "quest_test_123",
  title: "30-Minute Bird Quest",
  durationMinutes: 30,
  targetBirds: 2,
  tasks: [
    { id: "task_1", text: "Find 2 different bird species", isCompleted: false, type: "discovery" },
    { id: "task_2", text: "Photograph at least 1 bird", isCompleted: false, type: "photo" },
    { id: "task_3", text: "Observe quietly for 2 minutes", isCompleted: false, type: "observation" },
  ],
  createdAt: Date.now(),
};

let progress = initializeQuestProgress(mockQuest);
assert.strictEqual(progress.discoveredSpecies.length, 0);
assert.strictEqual(progress.photosCaptured, 0);
assert.strictEqual(progress.isCompleted, false);
console.log("✓ initializeQuestProgress passed");

console.log("3. Testing bird discovery (first unique species)...");
const res1 = recordBirdDiscovery("Common Myna (Acridotheres tristis)", mockQuest, progress);
assert.strictEqual(res1.isNewSpecies, true, "First sighting must be a new species");
progress = res1.updatedProgress;
assert.strictEqual(progress.discoveredSpecies.length, 1);
assert.strictEqual(progress.photosCaptured, 1);
assert.ok(progress.completedTaskIds.includes("task_2"), "Photo task should auto-complete on photo upload");
assert.strictEqual(progress.isCompleted, false, "Quest should not be completed yet (target is 2 birds)");
console.log("✓ First bird discovery recorded correctly");

console.log("4. Testing duplicate species prevention (Crucial Requirement)...");
const res2 = recordBirdDiscovery("Common Myna", mockQuest, progress);
assert.strictEqual(res2.isNewSpecies, false, "Duplicate species must NOT count as a new species");
progress = res2.updatedProgress;
assert.strictEqual(progress.discoveredSpecies.length, 1, "Discovered unique species count must remain 1");
assert.strictEqual(progress.photosCaptured, 2, "Photos count increases");

// Sighting the same species a 3rd time
const res3 = recordBirdDiscovery("COMMON MYNA (Acridotheres tristis)", mockQuest, progress);
assert.strictEqual(res3.isNewSpecies, false);
progress = res3.updatedProgress;
assert.strictEqual(progress.discoveredSpecies.length, 1, "Count must still be 1 after 3 sightings of same bird");
console.log("✓ Duplicate species duplicate prevention verified: 3 sightings = 1 unique species");

console.log("5. Testing second unique species...");
const res4 = recordBirdDiscovery("Red-vented Bulbul (Pycnonotus cafer)", mockQuest, progress);
assert.strictEqual(res4.isNewSpecies, true, "Different species must count as new species");
progress = res4.updatedProgress;
assert.strictEqual(progress.discoveredSpecies.length, 2, "Unique species count is now 2 (target reached!)");
assert.ok(progress.completedTaskIds.includes("task_1"), "Discovery task auto-completes when target reached");
console.log("✓ Second unique species reached bird target");

console.log("6. Testing manual task toggling and Quest Completion...");
assert.strictEqual(progress.isCompleted, false, "Observation task is still pending");

// User toggles the quiet observation task checkbox
progress = toggleTaskCompletion("task_3", mockQuest, progress);
assert.ok(progress.completedTaskIds.includes("task_3"));
assert.strictEqual(checkQuestCompletion(mockQuest, progress), true);
assert.strictEqual(progress.isCompleted, true, "Quest must be marked complete when all requirements met");
assert.ok(progress.completedAt > 0, "completedAt timestamp recorded");
console.log("✓ Quest completion verified! 🎉");

console.log("7. Testing persistence (saveActiveQuest, loadActiveQuest, clearActiveQuest)...");
saveActiveQuest(mockQuest, progress);
const loaded = loadActiveQuest();
assert.ok(loaded);
assert.strictEqual(loaded.quest.id, mockQuest.id);
assert.strictEqual(loaded.progress.discoveredSpecies.length, 2);
assert.strictEqual(loaded.progress.isCompleted, true);

clearActiveQuest();
assert.strictEqual(loadActiveQuest(), null);
console.log("✓ Quest persistence verified in localStorage");

console.log("\nALL OUTDOOR QUEST TESTS PASSED! 🌲🌿🐦");
