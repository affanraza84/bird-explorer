# Bird Explorer (Milestones 1–7)

> Outdoor AI application for the **“Touch Grass” Open-Source AI Challenge**.  
> Generate time-boxed outdoor bird missions, verify real outdoor movement using privacy-first browser GPS, identify species using a locally running open-weight AI model (`qwen2.5vl:3b` via Ollama), capture 60-second audio field notes, reference a pre-bundled regional offline checklist, record habitat & environmental condition tags, log direct field observations, and persist discoveries in an offline field journal using IndexedDB. Zero external cloud AI APIs, zero remote tracking databases.

---

## The “Touch Grass” Philosophy

> **“The screen should be the shortest part of the experience.”**

Bird Explorer is intentionally designed to minimize screen time in nature:
1. **Time-Boxed Outdoor Mission**: The user selects how much time they have (15, 30, or 60 minutes).
2. **Put the Device Away**: The application tells the user: *"Your mission is ready. Put your phone away and start exploring."*
3. **Immerse in Nature**: Walk the trails, look up into tree canopies, listen for bird calls, and observe quietly.
4. **On-Device Movement Validation**: As you walk, browser GPS accumulates distance traveled locally in memory.
5. **Brief Interruption to Document**: Bring the device out only when spotting a bird to photograph and identify.
6. **Real Progress & Completion**: Discoveries and verified outdoor walking contribute to completing the mission.

---

## Privacy-First GPS Outdoor Validation (Milestone 4)

### Privacy Principle & Data Minimization
- **No Cloud Transmission**: GPS coordinates are **never** sent to Ollama, **never** sent to a backend API, and **never** sent to any cloud server or telemetry provider.
- **No Coordinate History Stored**: The application never saves a breadcrumb trail or database of where you walked. Exact coordinates are kept strictly in transient browser memory to calculate distance deltas between consecutive points.
- **Derived Activity Data Only**: Only the accumulated outdoor distance (e.g. `650 m`) and verification status (`tracking` / `denied`) are stored in active quest state.
- **Zero Lockout on Denied Permission**: If GPS permission is denied or unavailable, the application remains fully functional. Quests can still be completed with manual task verification, and the completion screen indicates distance was unverified.

### Haversine Distance Calculation
Distance between two geographic coordinates is calculated entirely on the client using the **Haversine formula**, accounting for Earth's curvature ($R = 6,371,000\text{ m}$):

$$\Delta\text{lat} = \text{lat}_2 - \text{lat}_1, \quad \Delta\text{lon} = \text{lon}_2 - \text{lon}_1$$
$$a = \sin^2\left(\frac{\Delta\text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta\text{lon}}{2}\right)$$
$$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right)$$
$$d = R \cdot c$$

### Segment Accumulation ($A \rightarrow B \rightarrow C$)
Instead of measuring straight-line displacement between the starting point and current point (which would report near-zero distance if a user walks a complete loop back to their starting position), Bird Explorer accumulates delta segments:
$$\text{Total Distance} = \text{dist}(A, B) + \text{dist}(B, C) + \text{dist}(C, D)$$

### GPS Noise & Jitter Filtering
Raw consumer GPS signals fluctuate even when a device is stationary on a park bench. Bird Explorer applies three defensive filters:
1. **Accuracy Filtering**: Discards readings with an accuracy radius worse than **100 meters** (such as cell-tower triangulation).
2. **Stationary Jitter Threshold**: Ignores movement increments under **8 meters** to eliminate stationary GPS drift.
3. **Anomalous Speed Rejection**: Discards impossible teleportation spikes exceeding **25 m/s** (~90 km/h).

### Battery Optimization
- Uses `navigator.geolocation.watchPosition` instead of aggressive polling loops.
- Automatically cleans up and releases hardware GPS listeners with `navigator.geolocation.clearWatch()` upon quest completion, quest cancellation, or component unmount.

---

## Architecture & System Flow

```
Browser (Installable Progressive Web App)
│
├── 📱 1. Offline PWA & Service Worker Shell (Milestone 6)
│   ├── Pre-cached application shell, static assets, and SVG/PNG icons
│   ├── Offline navigation fallback (opens app without internet in the woods)
│   ├── Client-side online/offline status indicator (🟢 Online / 🟡 Offline)
│   ├── Native PWA installation via beforeinstallprompt
│   └── Never caches backend AI /api/ endpoints
│
├── 📍 2. Privacy-First GPS Outdoor Validation (Milestone 4)
│   ├── Requests navigator.geolocation only upon starting a quest
│   ├── Calculates segment distances locally via Haversine formula
│   ├── Filters stationary jitter (<8m) & inaccurate readings (>100m)
│   ├── Tracks accumulated outdoor distance strictly in memory
│   └── Releases hardware GPS watcher via clearWatch() on completion
│
├── 🎯 3. Outdoor Bird Quest System (Milestone 3)
│   ├── User chooses duration (15 min, 30 min, 60 min)
│   ├── POST /api/generate-quest prompts Ollama for structured tasks
│   ├── Enforces deterministic distance goals (500m / 1.0km / 2.0km)
│   └── Active quest state persisted in browser localStorage (survives refresh)
│
├── 🧠 4. Bird Identification Pipeline (Milestone 1)
│   ├── User captures/uploads bird photo
│   ├── POST /api/identify-bird sends image buffer to Ollama (qwen2.5vl:3b)
│   ├── Model returns species identification
│   └── Feeds into Active Quest:
│       ├── Deduplicates species using normalized Set comparison
│       └── Auto-completes photography tasks
│
└── 📖 5. Offline Bird Journal, Audio Notes & Export (Milestones 2, 5 & 6)
    ├── Persistent field records stored in browser IndexedDB (v2 schema)
    ├── Optional 60-second Audio Field Notes via MediaRecorder
    ├── Instant client-side search (common name, scientific name, descriptions)
    ├── Multi-criteria filters (Confidence: High/Medium/Low; Date: Today/7d/30d/All)
    ├── Normalized deterministic statistics (Observations, Unique Species, High Confidence)
    ├── Accessible Observation Detail Modal with native audio player & recorder
    ├── Safe Object URL memory lifecycle management (URL.revokeObjectURL)
    └── 100% Client-side local data exports:
        ├── "Export All JSON" (with Base64 Data URL encoded photos & audio clips)
        └── "Export All CSV" (RFC 4180 escaped tabular data, metadata-only audio indicators)
```

---

## Storage & System Distinctions

Bird Explorer maintains a strict, transparent separation of concerns:

| Subsystem | Storage / Execution Target | Purpose & Privacy Guarantee |
| :--- | :--- | :--- |
| **IndexedDB (v2)** | Persistent local browser storage | Persistent offline field journal with photo Blobs & audio Blobs. Never leaves device. |
| **localStorage** | Transient browser key-value store | Ephemeral active quest state & task progress. Survives browser refresh during an excursion. |
| **Service Worker** | Cache Storage API (`bird-explorer-v1`) | Pre-cached application shell & static assets for zero-connectivity outdoor launches. |
| **Ollama** | Local daemon on `localhost:11434` | Open-weight vision AI inference (`qwen2.5vl:3b`) on device. Zero external cloud AI calls. |
| **Geolocation API** | Transient in-memory runtime | Client-side outdoor distance validation via Haversine deltas. No coordinates stored or transmitted. |
| **MediaRecorder** | Transient microphone stream | User-initiated 60s ambient bird audio recording. Microphone hardware released immediately on stop. |

---

## Milestone 6: Offline PWA & Audio Field Notes

### Part A — Progressive Web App & Offline Architecture
1. **Web App Manifest**: Full PWA manifest (`src/app/manifest.ts` & `public/manifest.json`) declaring `standalone` display, portrait orientation, theme color (`#059669`), and multi-resolution adaptive icons (`icon.svg`, `icon-192.png`, `icon-512.png`).
2. **Service Worker Strategy (`public/sw.js`)**:
   - Pre-caches core app shell on install (`/`, `/manifest.webmanifest`, icons).
   - Navigation requests use network-first with offline app shell fallback.
   - Static assets (`_next/static`, icons, fonts, CSS) use stale-while-revalidate / cache-first.
   - API endpoints (`/api/*`) are strictly excluded from cache and return a graceful offline response when disconnected.
3. **Connectivity Indicator**:
   - Real-time `🟢 Online` / `🟡 Offline` badge built using React 19's `useSyncExternalStore`.
   - Explains that journal exploration, GPS validation, audio recording, and exports remain 100% functional offline.
4. **Local AI Limitation Transparency**:
   - **Offline does NOT mean local AI identification is automatically available.**
   - If Ollama is unavailable or the device is disconnected, a transparent message explains that the local AI service is required for new image identifications, while all field and journal features remain active.
5. **Subtle Installation UX**: Captures browser `beforeinstallprompt` events and displays a non-intrusive "Install App" button without nagging or prompt spam.

### Part B — Audio Field Notes
1. **Explicit User-Initiated Recording**: Microphone access is requested only when the user explicitly clicks "Record Audio Note" (never on page load).
2. **Strict 60-Second Bound**: The recording session enforces an automatic 60-second ceiling with live timer display (`00:14 / 01:00`) and auto-stop.
3. **Hardware Stream Release**: All microphone hardware tracks are immediately stopped upon completion or cancellation.
4. **Dynamic MIME Type Detection**: Automatically selects the best supported browser audio container (`audio/webm;codecs=opus`, `audio/webm`, `audio/mp4`, `audio/ogg`, or `audio/wav`).
5. **IndexedDB v2 Schema Evolution**:
   - Non-breaking upgrade from v1 to v2: existing journal sightings are preserved completely intact.
   - Sightings support optional `audio: Blob`, `audioMimeType: string`, and `audioDurationMs: number`.
   - Helper methods: `attachAudioToSighting` and `removeAudioFromSighting`.
6. **Native HTML Audio Player**: Played back directly in the Observation Detail Modal using `<audio controls />` with zero external audio libraries.
7. **Enhanced Data Export**:
   - **JSON Export**: Encodes audio Blobs into Base64 Data URLs (`data:audio/webm;base64,...`) alongside image data. Audio fields are omitted when no recording exists.
   - **CSV Export**: Adds `hasAudio` (`true`/`false`) and `audioDurationMs` metadata columns. Omits raw binary data to prevent spreadsheet bloat.

---

## Milestone 5: Journal Exploration & Local Data Export

### 1. Instant Client-Side Search
- Real-time search across common bird names, scientific names in parentheses, and detailed field notes.
- Case-insensitive and whitespace-tolerant without sending queries to any backend or AI model.

### 2. Multi-Criteria Filtering
- **Confidence**: All, High, Medium, Low (normalized qualitative mapping).
- **Date Ranges**: All time, Today (local midnight boundary), Last 7 days, Last 30 days.
- Filters and search compose together seamlessly.

### 3. Taxonomy Normalization & Live Statistics
- Dynamic lightweight stats banner displaying total observations, unique species, and high-confidence sightings.
- Species normalization automatically collapses casing and scientific suffixes (`"House Sparrow"`, `"house sparrow"`, `"HOUSE SPARROW"` -> 1 unique species).

### 4. Accessible Observation Detail Modal
- Complete view of observation details: high-resolution photo, species name, confidence badge, full observation notes, and exact timestamp.
- Accessible modal semantics (`role="dialog"`, `aria-modal="true"`, focus management), close via Escape key or backdrop click, and background scroll-lock protection.

### 5. Local JSON & CSV Export
- **Export All JSON**: Encodes stored image Blobs into browser-compatible Base64 Data URLs and triggers local file download.
- **Export All CSV**: Generates RFC 4180 compliant CSV files with full escaping for commas, quotes, and newlines; omits raw binary blobs for clean spreadsheet compatibility.
- 100% local-first: no backend endpoints, no telemetry, explicit user initiation.

---

## Field Observation System & Offline Regional Checklist (Milestone 7)

### 1. Offline Birding Checklist
- **Pre-Bundled Regional Dataset**: Bundles 48 common species suited for Jharkhand, Eastern, and Central India across urban gardens, woodlands, wetlands, and raptor habitats (e.g. *House Sparrow*, *Common Myna*, *Indian Peafowl*, *Common Kingfisher*, *Black Kite*).
- **100% Offline & Lightweight**: No images or network calls required for the checklist reference.
- **Fast Client-Side Search & Filtering**: Instant, case-insensitive, whitespace-tolerant search by common name, scientific name, or family, combined with habitat filters (`all`, `garden`, `urban`, `woodland`, `wetland`, `grassland`, `farmland`, `coastal`).
- **Live Statistics**: Real-time counter of total species, observed species, and remaining unobserved species.

### 2. Habitat & Environmental Condition Tags
- **Controlled Habitat Classification**: Structured metadata (`woodland`, `wetland`, `grassland`, `urban`, `garden`, `farmland`, `coastal`, `other`).
- **Manual Environmental Conditions**: Weather conditions (`sunny`, `partly-cloudy`, `overcast`, `rainy`, `foggy`) selected manually by the observer.
  > **Note:** Environmental conditions are intentionally user-recorded so the feature remains offline-first and does not require location or network services.
- **Naturalist Behavior Tags**: Controlled action tags (`feeding`, `flying`, `perched`, `singing`, `calling`, `nesting`, `drinking`, `bathing`, `foraging`, `flocking`) with automatic deduplication.

### 3. Manual Field Observations (No Photo Required)
- **Direct Checklist Logging**: Quickly tap `[ + Mark Observed ]` to increment sighting counts without photo overhead.
- **Field Note Logging Modal**: Tap `[ 🔭 Log Field Note ]` to save a structured observation directly to the local Bird Journal without requiring a camera or photo Blob (`image?: Blob`).
- **Graceful Card Presentation**: Observations recorded without photos display a clean, handsome field badge and binoculars icon instead of broken images or fake blobs.

### 4. Edit Observation Metadata
- **Observation Detail Modal**: Seamlessly view habitat badges, weather conditions, and behavior tags.
- **In-Place Editing**: Click `[ Edit Observation ]` to update habitat, weather condition, behavior tags, and field notes without re-identifying the bird.

### 5. AI Vision & Checklist Integration
- **Deterministic Species Matching**: AI vision results (`qwen2.5vl:3b`) are deterministically normalized and mapped to matching checklist entries (e.g., *"House Sparrow (Passer domesticus)"* matches `house-sparrow`).
- **Automatic History Updates**: AI identification automatically increments the checklist history for recognized species without altering non-checklist sightings or creating fake entries.

### 6. Active Quest Integration
- **Explicit Field Observations**: Manually logging and confirming a field observation increments the active quest's unique species counter.
- **Discovery Protection**: Merely searching, browsing, or filtering the checklist never triggers quest progress.

### 7. IndexedDB v3 Schema Migration
- Seamlessly upgrades from `v2` to `v3` by adding the `checklist_history` object store (keyed by `speciesId`) while preserving existing `sightings` records, binary Blobs, audio notes, and timestamps.

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

3. Run the automated test suite (IndexedDB journal + Quest progress + GPS Haversine validation + Field Checklist):
   ```bash
   npm run test
   ```

4. Start the Next.js development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Automated Test Coverage

The test suite covers all milestones without external hardware or cloud dependencies:
- **`test-journal.mjs`**: IndexedDB initialization, binary Blob storage, chronological sorting, single deletion, clearing.
- **`test-quest.mjs`**: Quest generation schema, duplicate species normalization (`Set`), task toggling, completion detection, `localStorage` persistence.
- **`test-geolocation.mjs`**: Haversine distance accuracy, segment accumulation, stationary jitter filtering (<8m), poor accuracy rejection (>100m), clearWatch cleanup, and permission-denied fallbacks.
- **`test-journal-milestone5.mjs`**: Case-insensitive and whitespace-tolerant search, multi-criteria filtering, species taxonomy normalization, live stats computation, RFC 4180 CSV escaping, Base64 JSON export preparation, and graceful empty state handling.
- **`test-audio-journal.mjs`**: 60-second audio duration boundaries, MIME type detection, IndexedDB v2 schema migration, optional audio persistence and retrieval, attaching/removing audio on existing sightings, Base64 audio JSON export, metadata-only CSV export, and PWA manifest/service-worker file integrity.
- **`test-field-observations.mjs`**: Habitat validation, weather condition validation, behavior tag deduplication, 48-species checklist loading, client-side search and habitat filtering, deterministic AI checklist mapping, IndexedDB v3 checklist history persistence, photo-less manual field observations, observation metadata editing, and quest discovery tracking.
