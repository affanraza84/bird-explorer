import assert from "node:assert";

// Import Milestone 5 modules
const {
  normalizeSpeciesName,
  classifyConfidence,
  isDateInRange,
  matchesSearch,
  filterSightings,
  calculateJournalStats,
} = await import("./src/lib/journal-utils.ts");

const {
  escapeCsvField,
  generateJournalCsv,
  blobToDataUrl,
  prepareJournalJson,
  exportJournalAsJSON,
  exportJournalAsCSV,
} = await import("./src/lib/journal-export.ts");

console.log("=== MILESTONE 5: JOURNAL EXPLORATION & EXPORT TESTS ===\n");

// ---------------------------------------------------------
// 1. Species Normalization
// ---------------------------------------------------------
console.log("1. Testing Species Normalization...");
const name1 = normalizeSpeciesName("House Sparrow");
const name2 = normalizeSpeciesName("house sparrow");
const name3 = normalizeSpeciesName("HOUSE SPARROW");
const name4 = normalizeSpeciesName("  House   Sparrow  ");
const nameWithScientific = normalizeSpeciesName("House Sparrow (Passer domesticus)");

assert.strictEqual(name1, "house sparrow");
assert.strictEqual(name2, "house sparrow");
assert.strictEqual(name3, "house sparrow");
assert.strictEqual(name4, "house sparrow");
assert.strictEqual(nameWithScientific, "house sparrow");

// Unique species set test
const uniqueSet = new Set([name1, name2, name3, name4, nameWithScientific]);
assert.strictEqual(uniqueSet.size, 1, "All casing and scientific variations should normalize to 1 unique species");
console.log("✓ Species normalization passed (casing, whitespace, scientific brackets -> 1 unique species)");

// ---------------------------------------------------------
// 2. Search & Case Insensitivity
// ---------------------------------------------------------
console.log("2. Testing Search matching...");
const mockSightings = [
  {
    id: "s1",
    species: "House Sparrow (Passer domesticus)",
    description: "Small brown bird commonly found around human dwellings.",
    confidence: "High",
    image: new Blob(["dummy-image-1"], { type: "image/jpeg" }),
    createdAt: Date.now() - 1000 * 60 * 30, // 30 minutes ago (today)
  },
  {
    id: "s2",
    species: "Northern Cardinal (Cardinalis cardinalis)",
    description: "Vibrant red plumage with black face mask and crest.",
    confidence: "Likely species",
    image: new Blob(["dummy-image-2"], { type: "image/jpeg" }),
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3, // 3 days ago
  },
  {
    id: "s3",
    species: "Blue Jay (Cyanocitta cristata)",
    description: "Loud, bold bird with blue crest and white underparts.",
    confidence: "Uncertain",
    image: new Blob(["dummy-image-3"], { type: "image/jpeg" }),
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 15, // 15 days ago
  },
  {
    id: "s4",
    species: "HOUSE SPARROW",
    description: "Female sparrow foraging on seed ground.",
    confidence: "Medium",
    image: new Blob(["dummy-image-4"], { type: "image/jpeg" }),
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 45, // 45 days ago
  },
];

// Common name search
assert.strictEqual(matchesSearch(mockSightings[0], "house sparrow"), true);
// Case variations
assert.strictEqual(matchesSearch(mockSightings[0], "SPARROW"), true);
assert.strictEqual(matchesSearch(mockSightings[0], "sparrow"), true);
assert.strictEqual(matchesSearch(mockSightings[0], "Sparrow"), true);
// Whitespace tolerance
assert.strictEqual(matchesSearch(mockSightings[0], "   house   sparrow   "), true);
// Scientific name search
assert.strictEqual(matchesSearch(mockSightings[0], "Passer"), true);
assert.strictEqual(matchesSearch(mockSightings[0], "domesticus"), true);
assert.strictEqual(matchesSearch(mockSightings[1], "cardinalis"), true);
// Description search
assert.strictEqual(matchesSearch(mockSightings[0], "human dwellings"), true);
assert.strictEqual(matchesSearch(mockSightings[1], "crest"), true);
// Non-matching query
assert.strictEqual(matchesSearch(mockSightings[0], "penguin"), false);
console.log("✓ Search passed (common name, scientific name, description, casing, whitespace tolerance)");

// ---------------------------------------------------------
// 3. Confidence Classification & Filtering
// ---------------------------------------------------------
console.log("3. Testing Confidence filtering...");
assert.strictEqual(classifyConfidence("High"), "high");
assert.strictEqual(classifyConfidence("high"), "high");
assert.strictEqual(classifyConfidence("Likely species"), "high");
assert.strictEqual(classifyConfidence("Medium"), "medium");
assert.strictEqual(classifyConfidence("Possible match"), "medium");
assert.strictEqual(classifyConfidence("Low"), "low");
assert.strictEqual(classifyConfidence("Uncertain"), "low");

const highOnly = filterSightings(mockSightings, {
  searchQuery: "",
  confidence: "high",
  dateRange: "all",
});
assert.strictEqual(highOnly.length, 2, "s1 (High) and s2 (Likely species) should both match high");
assert.ok(highOnly.every((s) => classifyConfidence(s.confidence) === "high"));

const lowOnly = filterSightings(mockSightings, {
  searchQuery: "",
  confidence: "low",
  dateRange: "all",
});
assert.strictEqual(lowOnly.length, 1);
assert.strictEqual(lowOnly[0].id, "s3");
console.log("✓ Confidence classification & filtering verified");

// ---------------------------------------------------------
// 4. Date Filtering
// ---------------------------------------------------------
console.log("4. Testing Date filtering...");
const now = Date.now();
// s1 is 30 mins ago -> Today, 7 days, 30 days, all
assert.strictEqual(isDateInRange(mockSightings[0].createdAt, "today", now), true);
assert.strictEqual(isDateInRange(mockSightings[0].createdAt, "7days", now), true);
assert.strictEqual(isDateInRange(mockSightings[0].createdAt, "30days", now), true);
assert.strictEqual(isDateInRange(mockSightings[0].createdAt, "all", now), true);

// s2 is 3 days ago -> NOT today, but within 7 days, 30 days, all
assert.strictEqual(isDateInRange(mockSightings[1].createdAt, "today", now), false);
assert.strictEqual(isDateInRange(mockSightings[1].createdAt, "7days", now), true);
assert.strictEqual(isDateInRange(mockSightings[1].createdAt, "30days", now), true);

// s3 is 15 days ago -> NOT today, NOT 7 days, but within 30 days
assert.strictEqual(isDateInRange(mockSightings[2].createdAt, "7days", now), false);
assert.strictEqual(isDateInRange(mockSightings[2].createdAt, "30days", now), true);

// s4 is 45 days ago -> Only within "all"
assert.strictEqual(isDateInRange(mockSightings[3].createdAt, "30days", now), false);
assert.strictEqual(isDateInRange(mockSightings[3].createdAt, "all", now), true);

const todayOnly = filterSightings(mockSightings, {
  searchQuery: "",
  confidence: "all",
  dateRange: "today",
}, now);
assert.strictEqual(todayOnly.length, 1);
assert.strictEqual(todayOnly[0].id, "s1");
console.log("✓ Date filtering verified (today, 7days, 30days, all)");

// ---------------------------------------------------------
// 5. Combined Filters (Search + Confidence + Date)
// ---------------------------------------------------------
console.log("5. Testing Combined Filtering...");
// Search "sparrow" + Confidence "high" + Date "all"
const combinedResult1 = filterSightings(mockSightings, {
  searchQuery: "sparrow",
  confidence: "high",
  dateRange: "all",
}, now);
assert.strictEqual(combinedResult1.length, 1);
assert.strictEqual(combinedResult1[0].id, "s1");

// Search "sparrow" + Confidence "medium" + Date "all"
const combinedResult2 = filterSightings(mockSightings, {
  searchQuery: "sparrow",
  confidence: "medium",
  dateRange: "all",
}, now);
assert.strictEqual(combinedResult2.length, 1);
assert.strictEqual(combinedResult2[0].id, "s4");

// Search "sparrow" + Date "today" -> s1
const combinedResult3 = filterSightings(mockSightings, {
  searchQuery: "sparrow",
  confidence: "all",
  dateRange: "today",
}, now);
assert.strictEqual(combinedResult3.length, 1);
assert.strictEqual(combinedResult3[0].id, "s1");

// Search "sparrow" + Date "today" + Confidence "low" -> none
const combinedResult4 = filterSightings(mockSightings, {
  searchQuery: "sparrow",
  confidence: "low",
  dateRange: "today",
}, now);
assert.strictEqual(combinedResult4.length, 0);
console.log("✓ Combined filtering passed (search + confidence + date acting simultaneously)");

// ---------------------------------------------------------
// 6. Journal Statistics Calculation
// ---------------------------------------------------------
console.log("6. Testing calculateJournalStats()...");
const stats = calculateJournalStats(mockSightings);
// mockSightings has:
// s1: House Sparrow
// s2: Northern Cardinal
// s3: Blue Jay
// s4: HOUSE SPARROW (duplicate species)
// Total observations: 4
// Unique species: 3 ("house sparrow", "northern cardinal", "blue jay")
// High confidence: 2 (s1 High, s2 Likely species)
assert.strictEqual(stats.totalObservations, 4, "Total observations must be 4");
assert.strictEqual(stats.uniqueSpeciesCount, 3, "Unique species must be 3 due to normalization");
assert.strictEqual(stats.highConfidenceCount, 2, "High confidence count must be 2");
console.log("✓ calculateJournalStats verified: 4 Observations, 3 Unique Species, 2 High Confidence");

// ---------------------------------------------------------
// 7. CSV Escaping & Generation
// ---------------------------------------------------------
console.log("7. Testing CSV Escaping and Generation...");
// Test commas, quotes, newlines escaping
assert.strictEqual(escapeCsvField("Simple text"), "Simple text");
assert.strictEqual(escapeCsvField("Text with, comma"), '"Text with, comma"');
assert.strictEqual(escapeCsvField('Text with "quotes" inside'), '"Text with ""quotes"" inside"');
assert.strictEqual(escapeCsvField("Line 1\nLine 2"), '"Line 1\nLine 2"');
assert.strictEqual(escapeCsvField('Complex, with "quotes", and\nnewlines'), '"Complex, with ""quotes"", and\nnewlines"');

const testCsvSightings = [
  {
    id: "test-1",
    species: "House Sparrow",
    confidence: "High",
    description: 'Small brown bird, "urban" habitat.\nObserved eating seeds.',
    createdAt: 1773300000000,
    image: new Blob(["dummy"]),
  },
];

const csvOutput = generateJournalCsv(testCsvSightings);
assert.ok(csvOutput.startsWith("id,species,confidence,description,createdAt"), "Header should be correct");
assert.ok(csvOutput.includes('"Small brown bird, ""urban"" habitat.\nObserved eating seeds."'), "CSV description must be RFC 4180 escaped");
assert.ok(csvOutput.includes("test-1"), "Observation ID must be present");
assert.ok(!csvOutput.includes("[object Blob]"), "Raw binary blob must NOT be present in CSV");
console.log("✓ CSV generation & RFC 4180 escaping verified");

// ---------------------------------------------------------
// 8. JSON Export Preparation
// ---------------------------------------------------------
console.log("8. Testing JSON Export Preparation...");
const dummyBlob = new Blob(["bird-photo-binary-bytes"], { type: "image/jpeg" });
const jsonSighting = {
  id: "json-1",
  species: "House Sparrow",
  confidence: "High",
  description: "Test description.",
  createdAt: 1773300000000,
  image: dummyBlob,
};

const dataUrl = await blobToDataUrl(dummyBlob);
assert.ok(dataUrl.startsWith("data:image/jpeg;base64,"), "Data URL must start with base64 MIME header");

const preparedJson = await prepareJournalJson([jsonSighting]);
assert.strictEqual(preparedJson.length, 1);
assert.strictEqual(preparedJson[0].id, "json-1");
assert.strictEqual(preparedJson[0].species, "House Sparrow");
assert.strictEqual(preparedJson[0].confidence, "High");
assert.strictEqual(preparedJson[0].description, "Test description.");
assert.ok(typeof preparedJson[0].createdAt === "string");
assert.ok(preparedJson[0].image.startsWith("data:image/jpeg;base64,"));
console.log("✓ JSON export preparation verified (Blob successfully converted to base64 Data URL)");

// ---------------------------------------------------------
// 9. Empty Journal Handling
// ---------------------------------------------------------
console.log("9. Testing Empty Journal Export...");
try {
  await exportJournalAsJSON([]);
  assert.fail("exportJournalAsJSON should throw on empty array");
} catch (err) {
  assert.match(err.message, /There are no observations to export yet/i);
  console.log("✓ exportJournalAsJSON throws expected friendly error for empty journal");
}

try {
  exportJournalAsCSV([]);
  assert.fail("exportJournalAsCSV should throw on empty array");
} catch (err) {
  assert.match(err.message, /There are no observations to export yet/i);
  console.log("✓ exportJournalAsCSV throws expected friendly error for empty journal");
}

console.log("\nALL MILESTONE 5 TESTS PASSED SUCCESSFULLY! 🎉🦅📖");
