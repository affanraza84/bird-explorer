import { BirdIdentification } from "@/types/bird";

interface ResultCardProps {
  result: BirdIdentification;
  onReset: () => void;
}

export function ResultCard({ result, onReset }: ResultCardProps) {
  const isUncertain =
    result.confidence.toLowerCase().includes("uncertain") ||
    result.species.toLowerCase().includes("unable") ||
    result.species.toLowerCase().includes("unknown");

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-950/5 overflow-hidden transition-all duration-300">
      {/* Top Banner */}
      <div
        className={`px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b ${
          isUncertain
            ? "bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200"
            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{isUncertain ? "⚠️" : "🕊️"}</span>
          <span className="text-sm font-semibold tracking-wide uppercase">
            {isUncertain ? "Uncertain Identification" : "Likely Species Match"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              isUncertain
                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
            }`}
          >
            Confidence: {result.confidence}
          </span>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-6 sm:p-8 space-y-6">
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-zinc-400 dark:text-zinc-500 mb-1">
            Identified Bird
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
            {result.species}
          </h2>
        </div>

        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/80">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
            Field Notes & Observable Characteristics
          </p>
          <p className="text-sm sm:text-base leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
            {result.description}
          </p>
        </div>

        {/* Local AI Provenance Footer */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Processed locally with Ollama (Qwen2.5-VL)</span>
          </div>

          <button
            onClick={onReset}
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Identify Another Bird
          </button>
        </div>
      </div>
    </div>
  );
}
