"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Heart, Pause, Play, Sparkles, X } from "lucide-react";
import { api, type ThreadStep } from "@/lib/api";

/**
 * Reminiscence Companion — the heart of Engram.
 *
 * Instead of a random slideshow, this walks the Cognee knowledge graph: it
 * starts at one memory and follows the *connections* — a shared person, place
 * or feeling — to lead someone gently from one memory to a related one they may
 * have forgotten. Each memory is read aloud in a warm voice and advances on its
 * own. Built for the people memories matter to most: aging parents, fading
 * memory, families preserving a story. Large type, high contrast, hands-free.
 */
export default function Reminisce() {
  const [thread, setThread] = useState<ThreadStep[]>([]);
  const [i, setI] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    api.reminisceThread().then((r) => setThread(r.thread || [])).catch(() => {});
  }, []);

  const go = useCallback(
    (delta: number) => {
      setI((prev) => (thread.length ? Math.min(Math.max(prev + delta, 0), thread.length - 1) : 0));
    },
    [thread.length],
  );

  const cur = thread[i];

  useEffect(() => {
    if (!started || !cur) return;
    clearTimeout(timerRef.current);
    const a = audioRef.current;
    if (a) {
      a.src = api.narrateUrl(cur.photo.id);
      a.load();
      if (!paused) a.play().catch(() => {});
    }
    if (!paused) timerRef.current = setTimeout(() => go(1), 19000);
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
    if (i < thread.length - 1) timerRef.current = setTimeout(() => go(1), 3200);
  }

  const atEnd = started && thread.length > 0 && i === thread.length - 1;

  return (
    <main className="relative flex min-h-screen flex-col bg-[#070a14] text-cream">
      <audio ref={audioRef} onEnded={onEnded} hidden />

      <Link
        href="/"
        className="absolute right-5 top-5 z-30 flex items-center gap-2 rounded-full border border-cream/20 px-4 py-2 text-base text-cream/70 transition hover:text-cream"
      >
        <X className="h-5 w-5" /> Exit
      </Link>

      <div className="absolute left-6 top-6 z-30 flex items-center gap-2 text-cream/60">
        <Heart className="h-5 w-5 text-ember" />
        <span className="text-base uppercase tracking-[0.25em]">Reminiscence</span>
      </div>

      {/* Entry */}
      <AnimatePresence>
        {!started && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#070a14] px-6 text-center"
          >
            <Heart className="mb-6 h-14 w-14 text-ember" />
            <h1 className="mb-3 font-serif text-4xl text-cream md:text-6xl">Let’s remember together</h1>
            <p className="mb-10 max-w-lg text-lg text-cream/60 md:text-xl">
              We’ll follow the threads between your memories — one moment leading gently to
              another — read aloud, all on their own.
            </p>
            <button
              onClick={() => setStarted(true)}
              disabled={!thread.length}
              className="flex items-center gap-3 rounded-full bg-ember px-10 py-5 text-2xl font-medium text-ink transition hover:brightness-110 disabled:opacity-40"
            >
              <Play className="h-7 w-7" /> {thread.length ? "Begin" : "Gathering memories…"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The memory */}
      {cur && (
        <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-44 pt-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={cur.photo.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.8 }}
              className="flex w-full max-w-4xl flex-col items-center"
            >
              {/* The graph connection that led us here — the signature moment */}
              {i > 0 && cur.connect && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mb-5 flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-5 py-2 text-base text-gold"
                >
                  <Sparkles className="h-4 w-4" />
                  {cur.connect}
                </motion.div>
              )}

              <div
                className="overflow-hidden rounded-3xl shadow-2xl"
                style={{ boxShadow: `0 30px 90px -20px ${cur.photo.palette?.[0] || "#000"}55` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cur.photo.url} alt={cur.photo.caption} className="max-h-[48vh] w-full object-contain" />
              </div>

              <p className="mt-8 max-w-3xl text-center font-serif text-2xl leading-relaxed text-cream md:text-3xl md:leading-snug">
                {cur.narration || cur.photo.caption}
              </p>

              {cur.shared.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {cur.shared.map((s) => (
                    <span key={s} className="rounded-full bg-cream/8 px-3 py-1 text-sm text-cream/55">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Controls */}
      {started && cur && (
        <div className="absolute inset-x-0 bottom-0 z-30 pb-8">
          <div className="mb-6 flex justify-center gap-1.5">
            {thread.map((s, idx) => (
              <span
                key={s.photo.id}
                className={`h-1.5 rounded-full transition-all ${idx === i ? "w-8 bg-ember" : "w-1.5 bg-cream/25"}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => go(-1)}
              disabled={i === 0}
              aria-label="Previous memory"
              className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-cream/25 text-cream transition hover:border-cream/60 hover:bg-cream/5 disabled:opacity-30"
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
              disabled={atEnd}
              aria-label="Next memory"
              className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-cream/25 text-cream transition hover:border-cream/60 hover:bg-cream/5 disabled:opacity-30"
            >
              <ChevronRight className="h-10 w-10" />
            </button>
          </div>
          <p className="mt-5 text-center text-base text-cream/40">
            memory {i + 1} of {thread.length} · {atEnd ? "the thread ends here" : paused ? "paused" : "following the thread"}
          </p>
        </div>
      )}
    </main>
  );
}
