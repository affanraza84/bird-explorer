import { Header } from "@/components/Header";
import { BirdUploader } from "@/components/BirdUploader";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:text-emerald-300">
      <div>
        <Header />

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-12">
          {/* Hero Section */}
          <section className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Milestone 1 • Local AI Vision Pipeline
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              Bird Explorer
            </h1>
            <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Identify birds using a locally running open-weight AI model.
            </p>
          </section>

          {/* Interactive Core Pipeline Component */}
          <section className="max-w-2xl mx-auto">
            <BirdUploader />
          </section>

          {/* Architecture & Pipeline Explanation Card */}
          <section className="max-w-2xl mx-auto rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-900/50 p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                How This Works (100% On-Device)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Zero external AI cloud APIs. Your images remain private and are processed locally on your machine.
              </p>
            </div>

            {/* Architecture Diagram */}
            <div className="grid grid-cols-1 sm:grid-cols-5 items-center gap-2 text-xs font-mono">
              <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-center border border-zinc-200 dark:border-zinc-700">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">Browser</div>
                <div className="text-[10px] text-zinc-500">Image Upload</div>
              </div>
              <div className="hidden sm:flex justify-center text-zinc-400 text-base">→</div>
              <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-center border border-zinc-200 dark:border-zinc-700">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">Next.js API</div>
                <div className="text-[10px] text-zinc-500">Base64 &amp; Prompt</div>
              </div>
              <div className="hidden sm:flex justify-center text-zinc-400 text-base">→</div>
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-center border border-emerald-300 dark:border-emerald-800/80">
                <div className="font-semibold text-emerald-800 dark:text-emerald-300">Ollama Local</div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400">Qwen2.5-VL:3b</div>
              </div>
            </div>

            <div className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800/80 pt-4 space-y-2">
              <p>
                <strong>Privacy &amp; Offline Ready:</strong> The browser never calls Ollama directly to prevent CORS issues and protect infrastructure. The server-side route handles format conversion and sends the base64 payload to the local Ollama daemon at <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[11px]">localhost:11434</code>.
              </p>
            </div>
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800/80 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
        <p>Bird Explorer • Built for the “Touch Grass” Open-Source AI Challenge</p>
      </footer>
    </div>
  );
}
