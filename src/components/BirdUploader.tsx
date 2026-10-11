"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import Image from "next/image";
import { BirdIdentification, BirdSighting, IdentifyBirdResponse } from "@/types/bird";
import { ResultCard } from "@/components/ResultCard";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

interface BirdUploaderProps {
  onSightingSaved?: (sighting: BirdSighting) => void;
  onBirdIdentified?: (species: string) => void;
}

export function BirdUploader({
  onSightingSaved,
  onBirdIdentified,
}: BirdUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<BirdIdentification | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleValidateAndSetFile = (file: File) => {
    setErrorMessage(null);
    setResult(null);

    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      setErrorMessage(
        "Unsupported image format. Please select a JPG, JPEG, PNG, or WEBP image."
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(
        "Image is too large. Please select an image under 10MB."
      );
      return;
    }

    if (file.size === 0) {
      setErrorMessage("The selected file is empty (0 bytes).");
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleValidateAndSetFile(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleValidateAndSetFile(file);
    }
  };

  const handleReset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);
    setResult(null);

    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      const response = await fetch("/api/identify-bird", {
        method: "POST",
        body: formData,
      });

      const data: IdentifyBirdResponse = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(
          ("error" in data && data.error) ||
            "Failed to identify bird. Please verify Ollama is running and try again."
        );
      } else {
        setResult(data.result);
        if (onBirdIdentified && data.result.species) {
          onBirdIdentified(data.result.species);
        }
      }
    } catch {
      setErrorMessage(
        "Network connection failed. Could not communicate with the Next.js server."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Upload & Preview Card */}
      {!result && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xl shadow-zinc-950/5 p-6 sm:p-8">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
            id="bird-file-input"
          />

          {!previewUrl ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                  : "border-zinc-300 dark:border-zinc-700 hover:border-emerald-500/70 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <svg
                  className="w-7 h-7"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>

              <div>
                <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
                  Drop a bird photo here, or{" "}
                  <span className="text-emerald-600 dark:text-emerald-400 underline underline-offset-2">
                    browse
                  </span>
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Supports JPG, PNG, or WEBP (up to 10MB)
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="relative rounded-xl overflow-hidden bg-zinc-950 flex items-center justify-center max-h-[420px] border border-zinc-200 dark:border-zinc-800">
                <div className="relative w-full h-80 sm:h-96">
                  <Image
                    src={previewUrl}
                    alt="Selected bird preview"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isLoading}
                  className="absolute top-3 right-3 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-900 text-zinc-300 hover:text-white backdrop-blur-sm transition-colors cursor-pointer disabled:opacity-50"
                  title="Remove image"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400 px-1">
                <div className="truncate max-w-xs font-mono">
                  {selectedFile?.name} (
                  {((selectedFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB)
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer disabled:opacity-50 font-medium"
                >
                  Change image
                </button>
              </div>
            </div>
          )}

          {/* Action button */}
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
            <button
              id="identify-bird-btn"
              type="button"
              onClick={handleSubmit}
              disabled={!selectedFile || isLoading}
              className={`w-full sm:w-auto px-6 py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                !selectedFile || isLoading
                  ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed shadow-none"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 active:scale-[0.99]"
              }`}
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-zinc-400 dark:text-zinc-500"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  <span>Analyzing image with local AI…</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <span>Identify Bird</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-4 sm:p-5 flex items-start gap-3 text-red-800 dark:text-red-300 shadow-sm">
          <svg
            className="w-5 h-5 text-red-500 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="flex-1 text-sm leading-relaxed">
            <p className="font-semibold mb-0.5">Identification Failed</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Result Card */}
      {result && (
        <ResultCard
          result={result}
          imageFile={selectedFile}
          onReset={handleReset}
          onSightingSaved={onSightingSaved}
        />
      )}
    </div>
  );
}
