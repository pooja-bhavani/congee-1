"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cityscape } from "@/components/Cityscape";
import { api, type Photo } from "@/lib/api";

const CITY_WORDS = ["city", "street", "road", "traffic", "night", "urban", "skyline", "downtown", "building", "lights", "car", "highway", "bridge"];

export default function CityPage() {
  const [cityPhotos, setCityPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const all = await api.photos();
        const match = all.filter((p) => {
          const hay = `${p.caption} ${p.scene} ${(p.tags || []).join(" ")}`.toLowerCase();
          return CITY_WORDS.some((w) => hay.includes(w));
        });
        setCityPhotos(match.length ? match : all.slice(0, 8));
      } catch {
        /* noop */
      }
    })();
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#06060c]">
      <div className="absolute inset-0">
        <Cityscape />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

      <div className="relative z-10 flex h-full flex-col p-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="pointer-events-auto text-sm text-cream/70 transition hover:text-gold">
            ← back to Engram
          </Link>
          <span className="text-xs uppercase tracking-[0.3em] text-cream/40">City Lights</span>
        </div>

        <div className="mt-6 max-w-xl">
          <h1 className="font-serif text-5xl font-semibold tracking-tight text-transparent bg-gradient-to-r from-cream via-gold to-ember bg-clip-text">
            The cities your memories wandered
          </h1>
          <p className="mt-3 text-cream/60">
            Every street, every late drive, every skyline you kept. The city never sleeps — and
            neither does your memory.
          </p>
        </div>

        <div className="mt-auto">
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-cream/40">
            city &amp; travel memories · {cityPhotos.length}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {cityPhotos.map((p) => (
              <div
                key={p.id}
                className="group relative h-28 w-44 shrink-0 overflow-hidden rounded-xl border border-cream/10"
                title={p.caption}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption} className="h-full w-full object-cover opacity-85 transition group-hover:opacity-100 group-hover:scale-105" />
                <span className="absolute bottom-0 left-0 right-0 truncate bg-black/55 px-2 py-1 text-[11px] text-cream/85">
                  {p.caption.slice(0, 40)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
