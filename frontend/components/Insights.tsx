"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Photo } from "@/lib/api";

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current!);
  }, [to]);
  return (
    <span>
      {n}
      {suffix}
    </span>
  );
}

export function Insights({ photos }: { photos: Photo[] }) {
  if (!photos.length) return null;

  const moods = new Set(photos.map((p) => (p.mood || "").split(",")[0].trim()).filter(Boolean));
  const people = photos.reduce((s, p) => s + (p.people || 0), 0);
  const years = photos
    .map((p) => (p.takenAt ? new Date(p.takenAt).getFullYear() : 0))
    .filter(Boolean);
  const span = years.length ? Math.max(...years) - Math.min(...years) + 1 : 0;

  const topMood = [...moods].sort(
    (a, b) =>
      photos.filter((p) => p.mood?.startsWith(b)).length -
      photos.filter((p) => p.mood?.startsWith(a)).length
  )[0];

  // "Life in color" — first palette swatch from each photo
  const swatches = photos
    .map((p) => p.palette?.[0])
    .filter(Boolean)
    .slice(0, 60) as string[];

  const stats = [
    { label: "memories", value: photos.length },
    { label: "moods", value: moods.size },
    { label: "years", value: span, suffix: "" },
    { label: "people", value: people },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="glass mb-5 overflow-hidden rounded-2xl"
    >
      <div className="flex flex-wrap items-center gap-6 p-5">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="font-serif text-3xl text-cream">
              <CountUp to={s.value} suffix={s.suffix} />
            </p>
            <p className="text-xs uppercase tracking-wider text-cream/40">{s.label}</p>
          </div>
        ))}
        {topMood && (
          <div className="ml-auto text-right">
            <p className="font-serif text-2xl capitalize text-ember">{topMood}</p>
            <p className="text-xs uppercase tracking-wider text-cream/40">your defining mood</p>
          </div>
        )}
      </div>
      {/* Life in color */}
      <div className="flex h-3 w-full">
        {swatches.map((c, i) => (
          <div key={i} style={{ background: c }} className="h-full flex-1" />
        ))}
      </div>
    </motion.section>
  );
}
