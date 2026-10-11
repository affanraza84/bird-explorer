"use client";

import { Habitat, WeatherCondition, ObservationTag } from "@/types/bird";

export const HABITAT_OPTIONS: { id: Habitat; label: string; icon: string }[] = [
  { id: "garden", label: "Garden", icon: "🏡" },
  { id: "urban", label: "Urban", icon: "🏙️" },
  { id: "woodland", label: "Woodland", icon: "🌲" },
  { id: "wetland", label: "Wetland", icon: "💧" },
  { id: "grassland", label: "Grassland", icon: "🌾" },
  { id: "farmland", label: "Farmland", icon: "🚜" },
  { id: "coastal", label: "Coastal", icon: "🌊" },
  { id: "other", label: "Other", icon: "🌿" },
];

export const WEATHER_OPTIONS: { id: WeatherCondition; label: string; icon: string }[] = [
  { id: "sunny", label: "Sunny", icon: "☀️" },
  { id: "partly-cloudy", label: "Partly Cloudy", icon: "⛅" },
  { id: "overcast", label: "Overcast", icon: "☁️" },
  { id: "rainy", label: "Rainy", icon: "🌧️" },
  { id: "foggy", label: "Foggy", icon: "🌫️" },
];

export const TAG_OPTIONS: { id: ObservationTag; label: string; icon: string }[] = [
  { id: "perched", label: "Perched", icon: "🪵" },
  { id: "flying", label: "Flying", icon: "🕊️" },
  { id: "singing", label: "Singing", icon: "🎵" },
  { id: "calling", label: "Calling", icon: "📢" },
  { id: "feeding", label: "Feeding", icon: "🐛" },
  { id: "foraging", label: "Foraging", icon: "🌿" },
  { id: "nesting", label: "Nesting", icon: "🪺" },
  { id: "bathing", label: "Bathing", icon: "🛁" },
  { id: "drinking", label: "Drinking", icon: "💧" },
  { id: "flocking", label: "Flocking", icon: "👥" },
];

interface ObservationMetadataSelectorProps {
  selectedHabitat?: Habitat;
  onHabitatChange: (habitat: Habitat | undefined) => void;
  selectedWeather?: WeatherCondition;
  onWeatherChange: (weather: WeatherCondition | undefined) => void;
  selectedTags: ObservationTag[];
  onTagsChange: (tags: ObservationTag[]) => void;
  disabled?: boolean;
}

export function ObservationMetadataSelector({
  selectedHabitat,
  onHabitatChange,
  selectedWeather,
  onWeatherChange,
  selectedTags,
  onTagsChange,
  disabled = false,
}: ObservationMetadataSelectorProps) {
  const toggleTag = (tag: ObservationTag) => {
    if (disabled) return;
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="space-y-4 text-left">
      {/* Habitat */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Habitat <span className="text-[10px] lowercase text-zinc-400">(optional)</span>
          </label>
          {selectedHabitat && !disabled && (
            <button
              type="button"
              onClick={() => onHabitatChange(undefined)}
              className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {HABITAT_OPTIONS.map((opt) => {
            const isSelected = selectedHabitat === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => onHabitatChange(isSelected ? undefined : opt.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  isSelected
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700/80"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Environmental Conditions */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Environmental Conditions <span className="text-[10px] lowercase text-zinc-400">(manual observation)</span>
          </label>
          {selectedWeather && !disabled && (
            <button
              type="button"
              onClick={() => onWeatherChange(undefined)}
              className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WEATHER_OPTIONS.map((opt) => {
            const isSelected = selectedWeather === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => onWeatherChange(isSelected ? undefined : opt.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  isSelected
                    ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                    : "bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700/80"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Observation Behavior Tags */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Behavior / Action <span className="text-[10px] lowercase text-zinc-400">(select all that apply)</span>
          </label>
          {selectedTags.length > 0 && !disabled && (
            <button
              type="button"
              onClick={() => onTagsChange([])}
              className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TAG_OPTIONS.map((opt) => {
            const isSelected = selectedTags.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => toggleTag(opt.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  isSelected
                    ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                    : "bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700/80"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
