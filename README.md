# Bird Explorer (Milestone 1)

> Outdoor AI application for the **“Touch Grass” Open-Source AI Challenge**.  
> Identify birds using a locally running open-weight AI model (`qwen2.5vl:3b` via Ollama). Zero external cloud AI APIs, 100% private and on-device.

---

## Architecture & Request Lifecycle

```
[ Browser / UI ]
       │
       ▼ (multipart/form-data upload via FormData)
[ Next.js API Route: POST /api/identify-bird ]
       │
       ├─ Validates MIME type (JPG, PNG, WEBP) & file size (≤ 10MB)
       ├─ Converts image ArrayBuffer to Base64
       │
       ▼ (HTTP POST to http://localhost:11434/api/generate)
[ Local Ollama Instance ]
       │
       ▼ (Executes vision weights locally on Apple Silicon / CPU / GPU)
[ Qwen2.5-VL Vision Model (qwen2.5vl:3b) ]
       │
       ▼ (Returns structured JSON response)
[ Next.js API Route ]
       │
       ▼ (JSON payload { success: true, result: { species, confidence, description } })
[ React UI ]
```

---

## Why the Browser Does Not Call Ollama Directly

1. **Security & Network Isolation**: Ollama runs on `http://localhost:11434` without authentication by default. Direct browser calls risk Cross-Origin Resource Sharing (CORS) blocks, expose internal network details, and cannot enforce server-side validation or rate-limiting.
2. **Payload Sanitization & Size Constraints**: Images are verified, typed, and size-capped on the server before consuming GPU/RAM memory on heavy AI inference.
3. **Prompt & Schema Control**: The prompt instructions, structured JSON schema enforcement, and temperature settings are centralized on the server, preventing client tampering.
4. **Clean Abstraction**: The frontend UI communicates with a standardized contract (`/api/identify-bird`), keeping the underlying AI runner configurable.

---

## How the Image Reaches the Vision Model

1. The user selects or drops an image in the React UI (`BirdUploader.tsx`).
2. The browser creates an in-memory object URL for instant preview, packs the raw file into a `FormData` object, and issues a `POST` request to `/api/identify-bird`.
3. The Next.js Route Handler (`src/app/api/identify-bird/route.ts`) reads the file buffer:
   ```ts
   const arrayBuffer = await file.arrayBuffer();
   const base64Data = Buffer.from(arrayBuffer).toString("base64");
   ```
4. The Base64 string is included in the JSON payload sent to Ollama's `/api/generate` endpoint alongside the vision prompt and JSON schema request:
   ```json
   {
     "model": "qwen2.5vl:3b",
     "prompt": "You are a bird identification assistant...",
     "images": ["<base64_string>"],
     "stream": false,
     "format": "json"
   }
   ```
5. Ollama converts the image tokens into visual embeddings and passes them through the multimodal vision-language layers of `qwen2.5vl:3b`.

---

## Understanding Ollama and Qwen2.5-VL

### What Ollama Does
- **Ollama** is a lightweight, open-source model execution runtime designed to run large language and multimodal models locally.
- It manages model memory allocation (quantized GGUF files), GPU acceleration (Metal on macOS, CUDA on Linux/Windows), context windows, and exposes a clean HTTP REST API at `http://localhost:11434`.

### What Qwen2.5-VL Does
- **Qwen2.5-VL** (specifically `qwen2.5vl:3b`) is a multimodal Vision-Language model developed by the Qwen team.
- Unlike text-only models, it possesses visual encoder blocks that tokenize image pixels directly, allowing it to "see" plumage patterns, beak geometry, posture, and environmental cues.
- The 3B parameter version is optimized to run efficiently on consumer hardware (such as Apple Silicon MacBooks) while retaining strong ornithological and general vision capabilities.

### Why This Qualifies as Local / Open-Weight AI
- The model weights are downloaded directly to the local disk.
- No inference requests are sent to OpenAI, Google, Anthropic, or any third-party cloud service.
- The pipeline functions completely offline once the model weights are pulled.

---

## Getting Started

### Prerequisites

1. **Node.js** (v18+ or v20+) and **npm**.
2. **Ollama** installed and running on your machine ([ollama.com](https://ollama.com)).
3. Pull the vision model:
   ```bash
   ollama pull qwen2.5vl:3b
   ```
4. Verify Ollama is running:
   ```bash
   curl http://localhost:11434/api/tags
   ```

### Installation & Running Locally

1. Install project dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables (optional, defaults to localhost:11434):
   ```bash
   cp .env.example .env.local
   ```
   Default contents:
   ```env
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=qwen2.5vl:3b
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## API Reference

### `POST /api/identify-bird`

**Request**: `multipart/form-data` containing an `image` (or `file`) field (JPG, PNG, WEBP up to 10MB).

**Success Response (200 OK)**:
```json
{
  "success": true,
  "result": {
    "species": "Northern Cardinal (Cardinalis cardinalis)",
    "confidence": "Possible match",
    "description": "A vibrant red bird with a distinctive crest on its head, perched on a branch. The beak is short and stout, typical of cardinals..."
  }
}
```

**Error Response (400 / 500)**:
```json
{
  "success": false,
  "error": "Ollama is not running. Start Ollama and try again."
}
```

### `GET /api/status`

Health-check endpoint to verify if local Ollama daemon is reachable and whether the target vision model is available.
