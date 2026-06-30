"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { api, type Photo } from "@/lib/api";

type MapPoint = Photo & { x: number; y: number };

/** Each memory's own dominant color becomes its light in the constellation. */
function dot(p: MapPoint): string {
  return p.palette?.[0] || "#e9b872";
}

/** Connect each point to its few nearest neighbors → faint constellation lines. */
function edges(points: MapPoint[], perNode = 2): [MapPoint, MapPoint][] {
  const seen = new Set<string>();
  const out: [MapPoint, MapPoint][] = [];
  points.forEach((a) => {
    const near = points
      .filter((b) => b.id !== a.id)
      .map((b) => ({ b, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 }))
      .sort((m, n) => m.d - n.d)
      .slice(0, perNode);
    near.forEach(({ b }) => {
      const key = [a.id, b.id].sort((x, y) => x - y).join("-");
      if (!seen.has(key)) {
        seen.add(key);
        out.push([a, b]);
      }
    });
  });
  return out;
}

export function MemoryMap({ onFocus }: { onFocus?: (p: Photo) => void }) {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [hover, setHover] = useState<MapPoint | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.map().then(setPoints).catch(() => {});
  }, []);

  const links = useMemo(() => (points.length > 3 ? edges(points) : []), [points]);

  if (points.length < 3) return null;

  return (
    <section className="mt-12">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="font-serif text-2xl text-cream">Memory Atlas</h2>
          <p className="text-sm text-cream/50">
            Every photo placed by what it <em>means</em> — Bedrock embeddings, projected to a sky you can wander.
          </p>
        </div>
        <span className="hidden items-center gap-1.5 text-xs text-cream/40 md:flex">
          <Sparkles className="h-3.5 w-3.5 text-ember" /> {points.length} memories · nearby stars feel alike
        </span>
      </div>

      <div
        ref={boxRef}
        className="glass relative aspect-[16/9] w-full overflow-hidden rounded-3xl"
        onMouseLeave={() => setHover(null)}
      >
        {/* faint nebula wash */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(233,184,114,0.10),transparent_55%),radial-gradient(circle_at_75%_70%,rgba(212,120,80,0.10),transparent_55%)]" />

        {/* constellation lines */}
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {links.map(([a, b], i) => {
            const lit = hover && (hover.id === a.id || hover.id === b.id);
            return (
              <line
                key={i}
                x1={a.x * 100}
                y1={a.y * 100}
                x2={b.x * 100}
                y2={b.y * 100}
                stroke={lit ? "rgba(233,184,114,0.55)" : "rgba(245,240,230,0.12)"}
                strokeWidth={lit ? 0.4 : 0.2}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {/* stars */}
        {points.map((p, i) => {
          const active = hover?.id === p.id;
          return (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.015, type: "spring", stiffness: 180, damping: 14 }}
              onMouseEnter={() => setHover(p)}
              onFocus={() => setHover(p)}
              onClick={() => onFocus?.(p)}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, color: dot(p) }}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              aria-label={p.caption}
            >
              <span
                className="block rounded-full transition-all duration-200"
                style={{
                  width: active ? 16 : 9,
                  height: active ? 16 : 9,
                  background: "currentColor",
                  boxShadow: active
                    ? "0 0 22px 6px currentColor"
                    : "0 0 9px 1px currentColor",
                }}
              />
            </motion.button>
          );
        })}

        {/* hover preview card */}
        {hover && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              left: `${Math.min(Math.max(hover.x * 100, 16), 84)}%`,
              top: `${hover.y * 100}%`,
            }}
            className="pointer-events-none absolute z-20 w-44 -translate-x-1/2 -translate-y-[calc(100%+18px)]"
          >
            <div className="glass overflow-hidden rounded-xl border border-cream/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hover.url} alt={hover.caption} className="h-24 w-full object-cover" />
              <div className="p-2.5">
                <p className="line-clamp-2 text-[11px] leading-snug text-cream/90">{hover.caption}</p>
                {hover.mood && (
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-ember/80">{hover.mood.split(",")[0]}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
