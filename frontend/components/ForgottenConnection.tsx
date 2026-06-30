"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { api, type Forgotten, type Photo } from "@/lib/api";

/** A serendipity moment: the knowledge graph surfaces two memories that quietly
 * rhyme — a connection you'd never have noticed yourself. Only a graph can do this. */
export function ForgottenConnection({ onFocus }: { onFocus?: (p: Photo) => void }) {
  const [data, setData] = useState<Forgotten | null>(null);

  useEffect(() => {
    api.forgottenConnection().then(setData).catch(() => {});
  }, []);

  if (!data || !data.found || !data.a || !data.b) return null;

  return (
    <section className="mt-12">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-gold" />
        <h2 className="font-serif text-2xl text-cream">A connection you’d forgotten</h2>
      </div>
      <div className="rounded-2xl border border-gold/20 bg-gradient-to-r from-gold/8 to-ember/8 p-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onFocus?.(data.a!)}
            className="group relative h-32 flex-1 overflow-hidden rounded-xl border border-cream/10"
            title={data.a.caption}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.a.url} alt={data.a.caption} className="h-full w-full object-cover transition group-hover:scale-105" />
          </button>

          <div className="flex shrink-0 flex-col items-center px-2 text-center">
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-cream/40">they share</div>
            <div className="flex max-w-[160px] flex-wrap justify-center gap-1.5">
              {(data.shared || []).map((s) => (
                <span key={s} className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs text-cream">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={() => onFocus?.(data.b!)}
            className="group relative h-32 flex-1 overflow-hidden rounded-xl border border-cream/10"
            title={data.b.caption}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.b.url} alt={data.b.caption} className="h-full w-full object-cover transition group-hover:scale-105" />
          </button>
        </div>
        <p className="mt-4 text-center text-sm text-cream/50">
          Two moments you might never connect — the graph noticed they rhyme.
        </p>
      </div>
    </section>
  );
}
