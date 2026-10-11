"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { BirdUploader } from "@/components/BirdUploader";
import { BirdJournal } from "@/components/BirdJournal";
import { BirdChecklist } from "@/components/BirdChecklist";
import { QuestSection } from "@/components/QuestSection";
import { Quest, QuestProgress } from "@/types/quest";
import { BirdSighting } from "@/types/bird";
import { BIRD_CHECKLIST } from "@/data/bird-checklist";
import { matchSpeciesToChecklist } from "@/lib/checklist-utils";
import { recordChecklistSighting } from "@/lib/bird-journal";
import {
  useActiveQuest,
  saveActiveQuest,
  clearActiveQuest,
  recordBirdDiscovery,
} from "@/lib/quest-storage";

export default function Home() {
  const [journalRefreshTrigger, setJournalRefreshTrigger] = useState(0);
  const [checklistRefreshTrigger, setChecklistRefreshTrigger] = useState(0);
  const [speciesNotice, setSpeciesNotice] = useState<string | null>(null);

  // Synchronize with browser local storage using React external store hook
  const activeQuestState = useActiveQuest();
  const activeQuest = activeQuestState?.quest ?? null;
  const questProgress = activeQuestState?.progress ?? null;

  const handleSightingSaved = (sighting?: BirdSighting) => {
    setJournalRefreshTrigger((prev) => prev + 1);
    // If the saved sighting matches a checklist entry, update checklist state
    if (sighting) {
      const match = matchSpeciesToChecklist(sighting.species, BIRD_CHECKLIST);
      if (match) {
        setChecklistRefreshTrigger((prev) => prev + 1);
      }
    }
  };

  const handleQuestStarted = (quest: Quest, progress: QuestProgress) => {
    saveActiveQuest(quest, progress);
    setSpeciesNotice(null);
  };

  const handleQuestUpdated = (progress: QuestProgress) => {
    if (activeQuest) {
      saveActiveQuest(activeQuest, progress);
    }
  };

  const handleQuestReset = () => {
    clearActiveQuest();
    setSpeciesNotice(null);
  };

  const handleBirdIdentified = (species: string) => {
    // 1. Checklist Integration: deterministically match against bundled checklist
    const matchedEntry = matchSpeciesToChecklist(species, BIRD_CHECKLIST);
    if (matchedEntry) {
      recordChecklistSighting(matchedEntry.id).then(() => {
        setChecklistRefreshTrigger((prev) => prev + 1);
      }).catch((err) => {
        console.error("Failed to record checklist sighting:", err);
      });
    }

    // 2. Active Quest Integration
    if (!activeQuest || !questProgress) return;

    const { isNewSpecies } = recordBirdDiscovery(
      species,
      activeQuest,
      questProgress
    );

    if (isNewSpecies) {
      setSpeciesNotice(
        `🌿 New discovery added: "${species}". Quest progress updated!`
      );
    } else {
      setSpeciesNotice(
        `ℹ️ "${species}" was already recorded for this quest. Only unique species count toward the discovery target!`
      );
    }
  };

  const handleFieldObservationSaved = (sighting: BirdSighting) => {
    // Refresh journal and checklist views
    setJournalRefreshTrigger((prev) => prev + 1);
    setChecklistRefreshTrigger((prev) => prev + 1);

    // Explicit manual field observation contributes to active quest if running
    if (activeQuest && questProgress) {
      const { isNewSpecies } = recordBirdDiscovery(
        sighting.species,
        activeQuest,
        questProgress
      );

      if (isNewSpecies) {
        setSpeciesNotice(
          `🌿 Field observation confirmed: "${sighting.species}". Quest progress updated!`
        );
      } else {
        setSpeciesNotice(
          `ℹ️ "${sighting.species}" was already counted for this active quest.`
        );
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:text-emerald-300">
      <div>
        <Header />

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-16">
          {/* Hero Section */}
          <section className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Milestone 7 • Offline Observation System &amp; Regional Checklist
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              Bird Explorer
            </h1>
            <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Start an outdoor AI bird quest, reference the offline regional checklist, and document your sightings with field tags.
            </p>
          </section>

          {/* Section 1: Outdoor Bird Quest */}
          <section className="max-w-2xl mx-auto">
            <QuestSection
              activeQuest={activeQuest}
              questProgress={questProgress}
              onQuestStarted={handleQuestStarted}
              onQuestUpdated={handleQuestUpdated}
              onQuestReset={handleQuestReset}
              lastIdentifiedSpeciesNotice={speciesNotice}
            />
          </section>

          {/* Section 2: Identification Pipeline (Upload / Camera) */}
          <section className="max-w-2xl mx-auto space-y-3">
            <div className="text-center sm:text-left">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>📸</span> Document a Bird Sighting
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Upload or capture a photo. The local vision AI will identify the species and update your quest progress.
              </p>
            </div>

            <BirdUploader
              onSightingSaved={handleSightingSaved}
              onBirdIdentified={handleBirdIdentified}
            />
          </section>

          {/* Section 3: Offline Bird Checklist */}
          <section>
            <BirdChecklist
              onFieldObservationSaved={handleFieldObservationSaved}
              refreshTrigger={checklistRefreshTrigger}
            />
          </section>

          {/* Section 4: Bird Journal */}
          <section>
            <BirdJournal refreshTrigger={journalRefreshTrigger} />
          </section>

          {/* Section 5: Architecture & Philosophy */}
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-900/50 p-6 sm:p-8 space-y-6">
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
                Naturalist Field Architecture (Touch Grass Open-Source AI)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Zero cloud dependencies. Everything runs locally on device:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-4 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-1.5">
                <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                  🎯 1. Outdoor Quest
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-sans leading-relaxed">
                  Local Ollama LLM missions encourage going outdoors and exploring nature.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-1.5">
                <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                  🧠 2. Vision Inference
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-sans leading-relaxed">
                  <code className="px-1 rounded bg-zinc-200 dark:bg-zinc-700">qwen2.5vl:3b</code> identifies bird field marks locally without external cloud APIs.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-1.5">
                <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                  📋 3. Field Checklist
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-sans leading-relaxed">
                  Pre-bundled offline reference with habitat &amp; behavior tags. No network needed.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-1.5">
                <div className="font-semibold text-emerald-800 dark:text-emerald-300">
                  📖 4. Offline Journal
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-sans leading-relaxed">
                  IndexedDB v3 preserves full photos, audio recordings, field tags, and checklist history.
                </p>
              </div>
            </div>

            <div className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800/80 pt-4">
              <p>
                <strong>The Touch Grass Philosophy:</strong> &ldquo;The screen should be the shortest part of the experience.&rdquo; Look up, listen, and observe birds in the physical world.
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
