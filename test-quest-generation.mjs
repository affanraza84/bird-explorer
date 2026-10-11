import assert from "node:assert";

// Polyfill minimal NextRequest / NextResponse environment if needed in Node
const { getBuiltinQuest, validateQuest } = await import(
  "./src/lib/builtin-quests.ts"
);
const { isOllamaUnavailableError, OllamaUnavailableError, OllamaModelError } =
  await import("./src/lib/ollama.ts");
const { POST: generateQuestRoute } = await import(
  "./src/app/api/generate-quest/route.ts"
);
const { POST: identifyBirdRoute } = await import(
  "./src/app/api/identify-bird/route.ts"
);

console.log("=== TESTS: QUEST GENERATION & DEPLOYMENT FALLBACK ===");

// 0. Test Custom Error Classes & Error Classifier
console.log("\n0. Testing error classification...");
const connErr = new OllamaUnavailableError("Ollama stopped");
const modelErr = new OllamaModelError("Model output invalid");
assert.strictEqual(isOllamaUnavailableError(connErr), true);
assert.strictEqual(isOllamaUnavailableError(new TypeError("fetch failed")), true);
assert.strictEqual(isOllamaUnavailableError(new Error("ECONNREFUSED")), true);
assert.strictEqual(isOllamaUnavailableError(modelErr), false);
assert.strictEqual(isOllamaUnavailableError(new Error("Something else")), false);
console.log("✓ Custom error classes and classifier verified");

// 1. Validate Built-in Quests schema and deterministic values
console.log("\n1. Testing built-in quest templates & validation...");
for (const duration of [15, 30, 60]) {
  const quest = getBuiltinQuest(duration);
  const result = validateQuest(quest, duration);
  assert.strictEqual(
    result.valid,
    true,
    `Built-in quest for ${duration}m failed validation: ${result.error}`
  );
  assert.strictEqual(quest.durationMinutes, duration);
  assert.strictEqual(
    quest.distanceTargetMeters,
    duration === 15 ? 500 : duration === 30 ? 1000 : 2000
  );
  assert.strictEqual(
    quest.targetBirds,
    duration === 15 ? 1 : duration === 30 ? 2 : 3
  );
  assert.strictEqual(quest.source, "builtin");
  assert.ok(quest.tasks.length >= 2 && quest.tasks.length <= 4);
  assert.ok(!/\bai\b/i.test(quest.title));
  console.log(`✓ Built-in ${duration}-minute quest template validated`);
}

// 2. ValidateQuest defensive tests
console.log("\n2. Testing validateQuest defensive edge cases...");
assert.strictEqual(validateQuest(null).valid, false);
assert.strictEqual(validateQuest({}).valid, false);
assert.strictEqual(
  validateQuest({
    id: "q1",
    title: "Test",
    durationMinutes: 45, // invalid duration
    targetBirds: 2,
    distanceTargetMeters: 1000,
    tasks: [],
    createdAt: Date.now(),
  }).valid,
  false
);
assert.strictEqual(
  validateQuest({
    id: "q1",
    title: "Test",
    durationMinutes: 30,
    targetBirds: 2,
    distanceTargetMeters: 500, // mismatch for 30m
    tasks: [{ id: "t1", text: "Walk", isCompleted: false, type: "discovery" }],
    createdAt: Date.now(),
  }).valid,
  false
);
console.log("✓ validateQuest properly rejects invalid structures");

// Save original global fetch
const originalFetch = globalThis.fetch;

try {
  // 3. Test Successful Ollama Generation
  console.log("\n3. Testing Successful Ollama quest generation...");
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        response: JSON.stringify({
          title: "30-Minute Morning Woodland Trail",
          durationMinutes: 30,
          targetBirds: 2,
          tasks: [
            "Spot 2 distinct birds in the upper tree canopy",
            "Photograph at least 1 bird perched",
            "Listen quietly for 3 minutes to identify bird calls",
          ],
        }),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const reqSuccess = {
    json: async () => ({ durationMinutes: 30 }),
  };
  const resSuccess = await generateQuestRoute(reqSuccess);
  const dataSuccess = await resSuccess.json();

  assert.strictEqual(resSuccess.status, 200);
  assert.strictEqual(dataSuccess.success, true);
  assert.strictEqual(dataSuccess.generationSource, "ollama");
  assert.strictEqual(dataSuccess.quest.durationMinutes, 30);
  assert.strictEqual(dataSuccess.quest.distanceTargetMeters, 1000);
  assert.strictEqual(dataSuccess.quest.targetBirds, 2);
  assert.strictEqual(dataSuccess.quest.source, "ollama");
  assert.strictEqual(dataSuccess.quest.title, "30-Minute Morning Woodland Trail");
  console.log("✓ Successful Ollama quest generation verified");

  // 3b. Test Ollama Reasoning/Thinking Model output (response: "", thinking: "{...}")
  console.log("\n3b. Testing Ollama Reasoning/Thinking Model (e.g. qwen3:4b)...");
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        response: "",
        thinking: JSON.stringify({
          title: "15-Minute Forest Canopy Expedition",
          durationMinutes: 15,
          targetBirds: 1,
          tasks: [
            "Spot 1 bird in the forest canopy",
            "Photograph 1 bird perched",
            "Listen for 2 minutes to bird calls",
          ],
        }),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const reqThinking = {
    json: async () => ({ durationMinutes: 15 }),
  };
  const resThinking = await generateQuestRoute(reqThinking);
  const dataThinking = await resThinking.json();

  assert.strictEqual(resThinking.status, 200);
  assert.strictEqual(dataThinking.success, true);
  assert.strictEqual(dataThinking.generationSource, "ollama");
  assert.strictEqual(dataThinking.quest.durationMinutes, 15);
  assert.strictEqual(dataThinking.quest.title, "15-Minute Forest Canopy Expedition");
  console.log("✓ Reasoning model output in thinking field parsed and verified");

  // 4. Test Ollama Unavailable Fallback (Connection Refused / fetch failed)
  console.log("\n4. Testing Ollama Unavailable Fallback (ECONNREFUSED)...");
  globalThis.fetch = async () => {
    const err = new TypeError("fetch failed");
    err.cause = { code: "ECONNREFUSED" };
    throw err;
  };

  for (const duration of [15, 30, 60]) {
    const reqFallback = {
      json: async () => ({ durationMinutes: duration }),
    };
    const resFallback = await generateQuestRoute(reqFallback);
    const dataFallback = await resFallback.json();

    assert.strictEqual(resFallback.status, 200);
    assert.strictEqual(dataFallback.success, true);
    assert.strictEqual(dataFallback.generationSource, "builtin");
    assert.strictEqual(
      dataFallback.message,
      "Using a built-in quest because local AI is unavailable."
    );
    assert.strictEqual(dataFallback.quest.durationMinutes, duration);
    assert.strictEqual(
      dataFallback.quest.distanceTargetMeters,
      duration === 15 ? 500 : duration === 30 ? 1000 : 2000
    );
    assert.strictEqual(
      dataFallback.quest.targetBirds,
      duration === 15 ? 1 : duration === 30 ? 2 : 3
    );
    assert.strictEqual(dataFallback.quest.source, "builtin");
    assert.ok(!/\bai\b/i.test(dataFallback.quest.title));
    console.log(`✓ ${duration}-minute deterministic fallback returned successfully`);
  }

  // 5. Test Ollama Timeout Fallback (AbortError)
  console.log("\n5. Testing Ollama Timeout Fallback (AbortError)...");
  globalThis.fetch = async () => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    throw err;
  };

  const reqTimeout = {
    json: async () => ({ durationMinutes: 30 }),
  };
  const resTimeout = await generateQuestRoute(reqTimeout);
  const dataTimeout = await resTimeout.json();

  assert.strictEqual(resTimeout.status, 200);
  assert.strictEqual(dataTimeout.success, true);
  assert.strictEqual(dataTimeout.generationSource, "builtin");
  assert.strictEqual(dataTimeout.quest.durationMinutes, 30);
  console.log("✓ Timeout gracefully triggered deterministic fallback");

  // 6. Test Invalid Duration (Must return 400, NEVER fallback!)
  console.log("\n6. Testing Invalid Duration (No Fallback)...");
  for (const invalidDuration of [45, "thirty", null, 0, 100]) {
    const reqInvalid = {
      json: async () => ({ durationMinutes: invalidDuration }),
    };
    const resInvalid = await generateQuestRoute(reqInvalid);
    const dataInvalid = await resInvalid.json();

    assert.strictEqual(resInvalid.status, 400);
    assert.strictEqual(dataInvalid.success, false);
    assert.ok(
      dataInvalid.error.includes("Invalid mission duration"),
      `Expected invalid duration error message, got: ${dataInvalid.error}`
    );
  }
  console.log("✓ Invalid durations strictly return 400 Bad Request without fallback");

  // 7. Test Malformed Model Output (Must NOT fallback, return genuine 500 error!)
  console.log("\n7. Testing Malformed Model Output (No Fallback)...");
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        response: "{ malformed json: true, unclosed... ",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const reqMalformed = {
    json: async () => ({ durationMinutes: 30 }),
  };
  const resMalformed = await generateQuestRoute(reqMalformed);
  const dataMalformed = await resMalformed.json();

  assert.strictEqual(resMalformed.status, 500);
  assert.strictEqual(dataMalformed.success, false);
  assert.ok(
    dataMalformed.error.toLowerCase().includes("invalid json") ||
      dataMalformed.error.toLowerCase().includes("model"),
    `Expected model error message, got: ${dataMalformed.error}`
  );
  console.log("✓ Malformed model output strictly returns error without hiding behind fallback");

  // 8. Test Empty Model Output (No Fallback)
  console.log("\n8. Testing Empty Model Output (No Fallback)...");
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        response: "",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const reqEmpty = {
    json: async () => ({ durationMinutes: 30 }),
  };
  const resEmpty = await generateQuestRoute(reqEmpty);
  const dataEmpty = await resEmpty.json();

  assert.strictEqual(resEmpty.status, 500);
  assert.strictEqual(dataEmpty.success, false);
  assert.ok(dataEmpty.error.includes("empty response"));
  console.log("✓ Empty model output strictly returns error without hiding behind fallback");

  // 9. Test Genuine Internal Request Errors (e.g. malformed JSON body)
  console.log("\n9. Testing Genuine Request Body Parsing Error...");
  const reqBadBody = {
    json: async () => {
      throw new SyntaxError("Unexpected token in JSON");
    },
  };
  const resBadBody = await generateQuestRoute(reqBadBody);
  const dataBadBody = await resBadBody.json();

  assert.strictEqual(resBadBody.status, 400);
  assert.strictEqual(dataBadBody.success, false);
  assert.ok(dataBadBody.error.includes("Invalid request body"));
  console.log("✓ Malformed request body correctly rejected with 400");

  // 10. Test Bird Identification in Deployed / Offline Environment
  console.log("\n10. Testing Honest Bird Identification Failure in Deployed Environment...");
  globalThis.fetch = async () => {
    const err = new TypeError("fetch failed");
    err.cause = { code: "ECONNREFUSED" };
    throw err;
  };

  const dummyBlob = new Blob(["dummy image data"], { type: "image/jpeg" });
  const dummyFile = new File([dummyBlob], "test-bird.jpg", {
    type: "image/jpeg",
  });
  const formData = new FormData();
  formData.append("image", dummyFile);

  const reqIdentify = {
    headers: {
      get: (h) => (h === "content-type" ? "multipart/form-data" : null),
    },
    formData: async () => formData,
  };

  const resIdentify = await identifyBirdRoute(reqIdentify);
  const dataIdentify = await resIdentify.json();

  assert.strictEqual(resIdentify.status, 500);
  assert.strictEqual(dataIdentify.success, false);
  assert.ok(
    dataIdentify.error.toLowerCase().includes("local ai vision model is unavailable") ||
      dataIdentify.error.toLowerCase().includes("photo identification requires a local ollama instance"),
    `Expected clear explanation of local vision limitation, got: ${dataIdentify.error}`
  );
  assert.ok(
    dataIdentify.error.toLowerCase().includes("regional checklist"),
    "Error must guide user to manual checklist logging"
  );
  console.log("✓ Honest bird identification error message verified (no hallucination/fabrication)");

} finally {
  globalThis.fetch = originalFetch;
}

console.log("\nALL QUEST GENERATION & DEPLOYMENT FALLBACK TESTS PASSED! 🚀🌿🎯");
