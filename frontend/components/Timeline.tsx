"use client";

import type { Photo } from "@/lib/api";

export function Timeline({
  photos,
  active,
  onPick,
}: {
  photos: Photo[];
  active: number | null;
  onPick: (year: number | null) => void;
}) {
  const counts = new Map<number, number>();
  for (const p of photos) {
    if (!p.takenAt) continue;
    const y = new Date(p.takenAt).getFullYear();
    counts.set(y, (counts.get(y) || 0) + 1);
  }
  const years = [...counts.keys()].sort();
  if (years.length < 2) return null;
  const max = Math.max(...counts.values());

  return (
    <div className="mb-5 flex items-end gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => onPick(null)}
        className={`shrink-0 rounded-full px-3 py-1 text-xs transition ${
          active === null ? "bg-cream text-ink" : "border border-cream/15 text-cream/60 hover:text-cream"
        }`}
      >
        All time
      </button>
      {years.map((y) => {
        const h = 8 + Math.round(((counts.get(y) || 0) / max) * 26);
        return (
          <button
            key={y}
            onClick={() => onPick(active === y ? null : y)}
            className="group flex shrink-0 flex-col items-center gap-1"
            title={`${counts.get(y)} memories`}
          >
            <div
              style={{ height: h }}
              className={`w-7 rounded-md transition ${
                active === y ? "bg-ember" : "bg-cream/15 group-hover:bg-cream/30"
              }`}
            />
            <span className={`text-[10px] ${active === y ? "text-ember" : "text-cream/40"}`}>{y}</span>
          </button>
        );
      })}
    </div>
  );
}
