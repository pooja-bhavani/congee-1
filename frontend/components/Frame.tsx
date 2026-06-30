"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Pause, Play, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import type { Photo } from "@/lib/api";
import { api } from "@/lib/api";

function yearsAgo(takenAt: string | null): string | null {
  if (!takenAt) return null;
  const then = new Date(takenAt);
  const now = new Date();
  const diff = now.getFullYear() - then.getFullYear();
  const month = then.toLocaleString("en", { month: "long" });
  if (diff <= 0) return `${month} ${then.getFullYear()}`;
  return `${diff} ${diff === 1 ? "year" : "years"} ago · ${month} ${then.getFullYear()}`;
}

export function Frame({ photos, fullscreen = false }: { photos: Photo[]; fullscreen?: boolean }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fav, setFav] = useState(false);
  const [narrate, setNarrate] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => setI(0), [photos]);

  const next = () => setI((x) => (x + 1) % photos.length);

  // Auto-advance. When narrating, we DON'T use a fixed timer — the slideshow
  // waits for the voice to finish (see onEnded) so it never cuts a sentence off.
  useEffect(() => {
    if (!playing || photos.length < 2 || narrate) return;
    const t = setInterval(next, 6500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, photos, narrate]);

  const photo = photos[i];
  useEffect(() => setFav(photo?.favorite ?? false), [photo]);

  // Amazon Polly reads each memory aloud when narration is on.
  useEffect(() => {
    clearTimeout(advanceTimer.current); // cancel any pending post-voice advance
    if (!narrate || !photo || !audioRef.current) return;
    audioRef.current.src = api.narrateUrl(photo.id);
    audioRef.current.play().catch(() => {});
  }, [narrate, photo]);

  // When the voice finishes, let it breathe, then move to the next memory.
  function onNarrationEnd() {
    if (!narrate || !playing || photos.length < 2) return;
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(next, 1600);
  }

  const glow = useMemo(() => {
    const p = photo?.palette?.length ? photo.palette : ["#D98E5A", "#E0B66E", "#16161C"];
    return `radial-gradient(60% 60% at 25% 20%, ${p[0]}55, transparent 60%),
            radial-gradient(50% 50% at 80% 30%, ${p[1] || p[0]}44, transparent 60%),
            radial-gradient(70% 60% at 50% 100%, ${p[2] || p[0]}33, transparent 60%), #0b0b0e`;
  }, [photo]);

  const heightCls = fullscreen ? "h-screen" : "h-[68vh]";
  const shellCls = fullscreen
    ? "relative overflow-hidden"
    : "relative overflow-hidden rounded-3xl border border-cream/10";

  if (!photo) {
    return (
      <div className={`flex ${heightCls} items-center justify-center rounded-3xl glass`}>
        <p className="text-cream/40">No memories yet — add a few photos below.</p>
      </div>
    );
  }

  const when = yearsAgo(photo.takenAt);

  return (
    <div className={shellCls} style={{ background: glow }}>
      <div className={`relative ${heightCls} w-full`}>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={photo.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1 }}
            className="absolute inset-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.caption}
              className="kenburns h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />
          </motion.div>
        </AnimatePresence>

        {/* Caption / story */}
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="max-w-3xl"
            >
              <div className="mb-2 flex items-center gap-3">
                {when && (
                  <p className="text-xs uppercase tracking-[0.25em] text-gold">{when}</p>
                )}
                {photo.palette?.length > 0 && (
                  <div className="flex gap-1">
                    {photo.palette.slice(0, 4).map((c, idx) => (
                      <span
                        key={idx}
                        style={{ background: c }}
                        className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20"
                      />
                    ))}
                  </div>
                )}
                {photo.people > 0 && (
                  <span className="text-xs text-cream/50">
                    · {photo.people} {photo.people === 1 ? "person" : "people"}
                  </span>
                )}
              </div>
              <p className="font-serif text-3xl leading-tight text-cream md:text-5xl">
                {photo.caption}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {photo.mood && <Tag>{photo.mood.split(",")[0]}</Tag>}
                {photo.tags?.slice(0, 4).map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="absolute right-5 top-5 flex gap-2">
          <Ctrl
            onClick={async () => {
              setFav((f) => !f);
              await api.favorite(photo.id);
            }}
            active={fav}
          >
            <Heart className={`h-4 w-4 ${fav ? "fill-ember text-ember" : ""}`} />
          </Ctrl>
          <Ctrl onClick={() => setNarrate((n) => !n)} active={narrate}>
            {narrate ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Ctrl>
          <Ctrl onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Ctrl>
        </div>
        <audio ref={audioRef} className="hidden" onEnded={onNarrationEnd} onError={onNarrationEnd} />

        {photos.length > 1 && (
          <>
            <Nav side="left" onClick={() => setI((x) => (x - 1 + photos.length) % photos.length)}>
              <ChevronLeft className="h-5 w-5" />
            </Nav>
            <Nav side="right" onClick={() => setI((x) => (x + 1) % photos.length)}>
              <ChevronRight className="h-5 w-5" />
            </Nav>
            <div className="absolute bottom-4 right-6 text-xs text-cream/50">
              {i + 1} / {photos.length}
            </div>
            {/* auto-advance progress */}
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
              {playing && !narrate && (
                <div key={photo.id} className="progressbar h-full bg-ember/80" />
              )}
              {narrate && (
                <div className="h-full w-full animate-pulse bg-ember/40" />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-cream/15 bg-black/30 px-3 py-1 text-xs capitalize text-cream/80 backdrop-blur">
      {children}
    </span>
  );
}

function Ctrl({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition ${
        active ? "bg-ember/20 text-ember" : "bg-black/40 text-cream/80 hover:bg-black/60"
      }`}
    >
      {children}
    </button>
  );
}

function Nav({ children, side, onClick }: { children: React.ReactNode; side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`absolute top-1/2 -translate-y-1/2 ${side === "left" ? "left-4" : "right-4"} flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-cream/80 opacity-0 backdrop-blur transition hover:bg-black/60 group-hover:opacity-100`}
      style={{ opacity: 0.6 }}
    >
      {children}
    </button>
  );
}
