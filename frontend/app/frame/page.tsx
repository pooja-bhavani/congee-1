"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Minimize2 } from "lucide-react";
import { api, type Photo } from "@/lib/api";
import { Frame } from "@/components/Frame";
import { Logo } from "@/components/Logo";

export default function CastPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [clock, setClock] = useState("");

  useEffect(() => {
    api.feed("shuffle").then(setPhotos).catch(() => {});
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <Frame photos={photos} fullscreen />

      {/* Ambient clock + brand overlay */}
      <div className="pointer-events-none absolute left-8 top-7 z-10 flex items-center gap-3">
        <Logo size={40} />
        <div>
          <p className="font-serif text-2xl text-cream/90 drop-shadow">{clock}</p>
          <p className="text-xs uppercase tracking-[0.3em] text-cream/50">Engram</p>
        </div>
      </div>

      <Link
        href="/"
        className="absolute right-6 top-7 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-cream/70 backdrop-blur transition hover:bg-black/60"
      >
        <Minimize2 className="h-4 w-4" />
      </Link>
    </main>
  );
}
