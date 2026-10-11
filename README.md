# Bird Explorer (Milestones 1, 2, 3 & 4)

> Outdoor AI application for the **“Touch Grass” Open-Source AI Challenge**.  
> Generate time-boxed outdoor bird missions, verify real outdoor movement using privacy-first browser GPS, identify species using a locally running open-weight AI model (`qwen2.5vl:3b` via Ollama), and persist discoveries in an offline field journal using IndexedDB. Zero external cloud AI APIs, zero remote tracking databases.

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
Browser
│
├── 📍 1. Privacy-First GPS Outdoor Validation (Milestone 4)
│   ├── Requests navigator.geolocation only upon starting a quest
│   ├── Calculates segment distances locally via Haversine formula
│   ├── Filters stationary jitter (<8m) & inaccurate readings (>100m)
│   ├── Tracks accumulated outdoor distance strictly in memory
│   └── Releases hardware GPS watcher via clearWatch() on completion
│
├── 🎯 2. Outdoor Bird Quest System (Milestone 3)
│   ├── User chooses duration (15 min, 30 min, 60 min)
│   ├── POST /api/generate-quest prompts Ollama for structured tasks
│   ├── Enforces deterministic distance goals (500m / 1.0km / 2.0km)
│   └── Active quest state persisted in browser localStorage (survives refresh)
│
├── 🧠 3. Bird Identification Pipeline (Milestone 1)
│   ├── User captures/uploads bird photo
│   ├── POST /api/identify-bird sends image buffer to Ollama (qwen2.5vl:3b)
│   ├── Model returns species identification
│   └── Feeds into Active Quest:
│       ├── Deduplicates species using normalized Set comparison
│       └── Auto-completes photography tasks
│
└── 📖 4. Offline Bird Journal (Milestone 2)
    ├── User clicks "Save to Journal" on ResultCard (explicit user control)
    └── Stores sighting + high-resolution photo Blob in browser IndexedDB
```

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

3. Run the automated test suite (IndexedDB journal + Quest progress + GPS Haversine validation):
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

The test suite covers all four milestones without external hardware dependencies:
- **`test-journal.mjs`**: IndexedDB initialization, binary Blob storage, chronological sorting, single deletion, clearing.
- **`test-quest.mjs`**: Quest generation schema, duplicate species normalization (`Set`), task toggling, completion detection, `localStorage` persistence.
- **`test-geolocation.mjs`**: Haversine distance accuracy, segment accumulation, stationary jitter filtering (<8m), poor accuracy rejection (>100m), clearWatch cleanup, and permission-denied fallbacks.
