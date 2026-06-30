"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Heart, Pause, Play, X } from "lucide-react";
import { api, type Photo } from "@/lib/api";

/**
 * Reminiscence Mode — built for the people memories matter to most.
 *
 * Large type, high contrast, hands-free. Each photo is read aloud in a warm
 * human voice (Amazon Polly) and gently advances on its own, so a grandparent
 * can simply sit and watch their life play back. Big, obvious buttons for when
 * they want to linger or move on.
 */
export default function Reminisce() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [i, setI] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    api
      .feed("shuffle")
      .then((p) => setPhotos(p))
      .catch(() => {});
  }, []);

  const go = useCallback(
    (delta: number) => {
      setI((prev) => (photos.length ? (prev + delta + photos.length) % photos.length : 0));
    },
    [photos.length]
  );

  const cur = photos[i];

  // Drive narration + gentle auto-advance whenever the photo (or play state) changes.
  useEffect(() => {
    if (!started || !cur) return;
    clearTimeout(timerRef.current);
    const a = audioRef.current;
    if (a) {
      a.src = api.narrateUrl(cur.id);
      a.load();
      if (!paused) a.play().catch(() => {});
    }
    // Fallback: if the voice can't load, still move on after a calm pause.
    if (!paused) timerRef.current = setTimeout(() => go(1), 17000);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, started, paused]);

  function togglePause() {
    const a = audioRef.current;
    setPaused((p) => {
      const next = !p;
      if (next) {
        a?.pause();
        clearTimeout(timerRef.current);
      } else {
        a?.play().catch(() => {});
      }
      return next;
    });
  }

  function onEnded() {
    if (paused) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => go(1), 2800); // let it breathe, then next
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-[#0a0806] text-cream">
      <audio ref={audioRef} onEnded={onEnded} hidden />

      {/* Exit */}
      <Link
        href="/"
        className="absolute right-5 top-5 z-30 flex items-center gap-2 rounded-full border border-cream/20 px-4 py-2 text-base text-cream/70 transition hover:text-cream"
      >
        <X className="h-5 w-5" /> Exit
      </Link>

      {/* Title */}
      <div className="absolute left-6 top-6 z-30 flex items-center gap-2 text-cream/60">
        <Heart className="h-5 w-5 text-ember" />
        <span className="text-base uppercase tracking-[0.25em]">Reminiscence</span>
      </div>

      {/* Entry — one big, calm button (also satisfies audio autoplay) */}
      <AnimatePresence>
        {!started && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#0a0806] px-6 text-center"
          >
            <Heart className="mb-6 h-14 w-14 text-ember" />
            <h1 className="mb-3 font-serif text-4xl text-cream md:text-6xl">Sit back and remember</h1>
            <p className="mb-10 max-w-md text-lg text-cream/60 md:text-xl">
              Your memories will play one by one, read aloud, all on their own.
            </p>
            <button
              onClick={() => setStarted(true)}
              disabled={!photos.length}
              className="flex items-center gap-3 rounded-full bg-ember px-10 py-5 text-2xl font-medium text-ink transition hover:brightness-110 disabled:opacity-40"
            >
              <Play className="h-7 w-7" /> Begin
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The memory */}
      {cur && (
        <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-44 pt-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={cur.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.8 }}
              className="flex w-full max-w-4xl flex-col items-center"
            >
              <div
                className="overflow-hidden rounded-3xl shadow-2xl"
                style={{ boxShadow: `0 30px 90px -20px ${cur.palette?.[0] || "#000"}55` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cur.url}
                  alt={cur.caption}
                  className="max-h-[52vh] w-full object-contain"
                />
              </div>
              <p className="mt-8 max-w-3xl text-center font-serif text-2xl leading-relaxed text-cream md:text-4xl md:leading-snug">
                {cur.caption}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Big, obvious controls */}
      {started && cur && (
        <div className="absolute inset-x-0 bottom-0 z-30 pb-8">
          {/* progress */}
          <div className="mb-6 flex justify-center gap-1.5">
            {photos.map((p, idx) => (
              <span
                key={p.id}
                className={`h-1.5 rounded-full transition-all ${
                  idx === i ? "w-8 bg-ember" : "w-1.5 bg-cream/25"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => go(-1)}
              aria-label="Previous memory"
              className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-cream/25 text-cream transition hover:border-cream/60 hover:bg-cream/5"
            >
              <ChevronLeft className="h-10 w-10" />
            </button>

            <button
              onClick={togglePause}
              aria-label={paused ? "Play" : "Pause"}
              className="flex h-24 w-24 items-center justify-center rounded-full bg-ember text-ink transition hover:brightness-110"
            >
              {paused ? <Play className="h-11 w-11" /> : <Pause className="h-11 w-11" />}
            </button>

            <button
              onClick={() => go(1)}
              aria-label="Next memory"
              className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-cream/25 text-cream transition hover:border-cream/60 hover:bg-cream/5"
            >
              <ChevronRight className="h-10 w-10" />
            </button>
          </div>
          <p className="mt-5 text-center text-base text-cream/40">
            {i + 1} of {photos.length} · {paused ? "Paused" : "Playing"}
          </p>
        </div>
      )}
    </main>
  );
}
