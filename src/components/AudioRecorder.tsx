"use client";

import { useState, useRef, useEffect } from "react";
import {
  AudioRecordingSession,
  MAX_AUDIO_DURATION_SECONDS,
  RecordedAudioResult,
} from "@/lib/audio-recorder";

interface AudioRecorderProps {
  onSaveAudio: (blob: Blob, mimeType: string, durationMs: number) => Promise<void> | void;
  onCancel?: () => void;
  isSaving?: boolean;
}

export function AudioRecorder({
  onSaveAudio,
  onCancel,
  isSaving = false,
}: AudioRecorderProps) {
  const [state, setState] = useState<"idle" | "recording" | "preview">("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordedResult, setRecordedResult] = useState<RecordedAudioResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const sessionRef = useRef<AudioRecordingSession | null>(null);

  // Clean up preview object URL on unmount or reset
  useEffect(() => {
    return () => {
      if (previewUrl) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch {
          // Ignore
        }
      }
      if (sessionRef.current?.isRecording()) {
        sessionRef.current.cancel();
      }
    };
  }, [previewUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleStartRecording = async () => {
    setErrorMessage(null);
    setElapsedSeconds(0);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setRecordedResult(null);

    const session = new AudioRecordingSession();
    sessionRef.current = session;

    try {
      await session.start(
        (seconds) => {
          setElapsedSeconds(seconds);
        },
        () => {
          // Auto-stop triggered at 60s
          handleStopRecording();
        }
      );
      setState("recording");
    } catch (err: unknown) {
      setState("idle");
      session.cancel();
      sessionRef.current = null;

      if (err instanceof Error) {
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError" ||
          err.message.includes("Permission denied") ||
          err.message.includes("not allowed")
        ) {
          setErrorMessage(
            "Microphone access was denied. You can enable microphone access in browser settings and try again."
          );
          return;
        }
        setErrorMessage(`Microphone error: ${err.message}`);
      } else {
        setErrorMessage("Microphone access was denied or is unavailable.");
      }
    }
  };

  const handleStopRecording = async () => {
    const session = sessionRef.current;
    if (!session) return;

    try {
      const result = await session.stop();
      setRecordedResult(result);
      const url = URL.createObjectURL(result.blob);
      setPreviewUrl(url);
      setState("preview");
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to finish recording audio."
      );
      setState("idle");
    } finally {
      sessionRef.current = null;
    }
  };

  const handleDiscard = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setRecordedResult(null);
    setState("idle");
    setErrorMessage(null);
    setElapsedSeconds(0);
  };

  const handleSave = async () => {
    if (!recordedResult) return;
    try {
      await onSaveAudio(
        recordedResult.blob,
        recordedResult.mimeType,
        recordedResult.durationMs
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save audio note."
      );
    }
  };

  return (
    <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🎙️</span>
          <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            Audio Field Note
          </h4>
        </div>

        {state === "recording" && (
          <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-red-600 dark:text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span>
              {formatTime(elapsedSeconds)} / {formatTime(MAX_AUDIO_DURATION_SECONDS)}
            </span>
          </div>
        )}
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-800 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      {/* Idle State */}
      {state === "idle" && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Record a short bird song, call, or ambient audio clip up to 60 seconds. Saved directly in your offline journal.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStartRecording}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors shadow-xs active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <span>Record Audio Note</span>
            </button>

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Recording State */}
      {state === "recording" && (
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-red-500 h-full transition-all duration-300 rounded-full"
              style={{
                width: `${(elapsedSeconds / MAX_AUDIO_DURATION_SECONDS) * 100}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Capturing ambient bird audio… (auto-stops at 1:00)
            </span>

            <button
              type="button"
              onClick={handleStopRecording}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white cursor-pointer transition-colors shadow-xs active:scale-95"
            >
              <span className="w-2 h-2 rounded-sm bg-white" />
              <span>Stop Recording</span>
            </button>
          </div>
        </div>
      )}

      {/* Preview State */}
      {state === "preview" && previewUrl && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Audio Preview</span>
            <span className="font-mono">
              {Math.round((recordedResult?.durationMs || 0) / 1000)} seconds
            </span>
          </div>

          <audio
            controls
            src={previewUrl}
            className="w-full h-10 accent-emerald-600 dark:accent-emerald-400"
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isSaving}
              className="px-3 py-1.5 text-xs text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 cursor-pointer disabled:opacity-50"
            >
              Discard &amp; Retake
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors shadow-xs disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Saving Note…</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save Audio Note</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
