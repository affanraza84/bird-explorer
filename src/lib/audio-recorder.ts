export interface RecordedAudioResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export const MAX_AUDIO_DURATION_SECONDS = 60;

/**
 * Detects the best supported audio MIME type in the current browser.
 */
export function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined") {
    return "audio/webm";
  }

  const preferredTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/wav",
  ];

  for (const type of preferredTypes) {
    try {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    } catch {
      // Continue checking next format
    }
  }

  return "";
}

/**
 * Controller class to manage a single audio recording session.
 * Enforces a strict 60-second limit and cleans up microphone hardware tracks on stop.
 */
export class AudioRecordingSession {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private startTime: number = 0;
  private autoStopTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onTimeUpdateCallback?: (elapsedSeconds: number) => void;
  private onAutoStopCallback?: () => void;

  /**
   * Starts microphone capture and audio recording.
   * Prompts user explicitly for microphone permission.
   */
  async start(
    onTimeUpdate?: (elapsedSeconds: number) => void,
    onAutoStop?: () => void
  ): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Audio recording is not supported on this browser or platform.");
    }

    this.onTimeUpdateCallback = onTimeUpdate;
    this.onAutoStopCallback = onAutoStop;
    this.recordedChunks = [];

    // Request microphone access upon explicit user invocation
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    const mimeType = getSupportedAudioMimeType();
    const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

    this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(250); // Collect data chunks every 250ms

    // Track elapsed seconds
    this.intervalId = setInterval(() => {
      if (this.startTime && this.onTimeUpdateCallback) {
        const elapsedSec = Math.min(
          MAX_AUDIO_DURATION_SECONDS,
          Math.floor((Date.now() - this.startTime) / 1000)
        );
        this.onTimeUpdateCallback(elapsedSec);
      }
    }, 500);

    // Auto-stop at 60 seconds
    this.autoStopTimeoutId = setTimeout(() => {
      if (this.isRecording()) {
        if (this.onAutoStopCallback) {
          this.onAutoStopCallback();
        }
        this.stop().catch((err) => {
          console.error("Error during auto-stop recording:", err);
        });
      }
    }, MAX_AUDIO_DURATION_SECONDS * 1000);
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }

  /**
   * Stops recording, releases microphone hardware, and returns the finished audio result.
   */
  async stop(): Promise<RecordedAudioResult> {
    this.cleanupTimers();

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        this.releaseStream();
        return reject(new Error("No active recording session found."));
      }

      const recorder = this.mediaRecorder;
      const durationMs = Math.min(
        MAX_AUDIO_DURATION_SECONDS * 1000,
        Math.max(0, Date.now() - this.startTime)
      );

      recorder.onstop = () => {
        try {
          const effectiveMimeType =
            recorder.mimeType || getSupportedAudioMimeType() || "audio/webm";
          const blob = new Blob(this.recordedChunks, { type: effectiveMimeType });

          this.releaseStream();
          this.mediaRecorder = null;

          resolve({
            blob,
            mimeType: effectiveMimeType,
            durationMs,
          });
        } catch (err) {
          this.releaseStream();
          reject(err);
        }
      };

      try {
        if (recorder.state !== "inactive") {
          recorder.stop();
        } else {
          recorder.onstop(new Event("stop"));
        }
      } catch (err) {
        this.releaseStream();
        reject(err);
      }
    });
  }

  /**
   * Cancels recording and releases hardware immediately without saving.
   */
  cancel(): void {
    this.cleanupTimers();

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignore error on cancel
      }
    }

    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.releaseStream();
  }

  private cleanupTimers(): void {
    if (this.autoStopTimeoutId) {
      clearTimeout(this.autoStopTimeoutId);
      this.autoStopTimeoutId = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private releaseStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop error
        }
      });
      this.mediaStream = null;
    }
  }
}
