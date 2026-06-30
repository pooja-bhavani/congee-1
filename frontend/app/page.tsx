"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Heart, MessageCircle, Play, Search, Sparkles, Trash2, Tv, Upload } from "lucide-react";
import { api, type Collection, type Photo } from "@/lib/api";
import { Frame } from "@/components/Frame";
import { AskPanel } from "@/components/AskPanel";
import { Reel } from "@/components/Reel";
import { Insights } from "@/components/Insights";
import { Timeline } from "@/components/Timeline";
import { ConceptConstellation } from "@/components/ConceptConstellation";
import { Logo } from "@/components/Logo";

type Mode = { key: string; label: string };
const MODES: Mode[] = [
  { key: "shuffle", label: "Shuffle" },
  { key: "favorites", label: "Favorites" },
  { key: "on-this-day", label: "On this day" },
];

export default function Home() {
  const [feed, setFeed] = useState<Photo[]>([]);
  const [all, setAll] = useState<Photo[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [mode, setMode] = useState("shuffle");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [activeLabel, setActiveLabel] = useState("Shuffle");
  const [uploading, setUploading] = useState(0);
  const [askOpen, setAskOpen] = useState(false);
  const [reel, setReel] = useState<{ title: string; photos: (Photo & { line: string })[] } | null>(null);
  const [loadingReel, setLoadingReel] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function playReel() {
    setLoadingReel(true);
    try {
      const m = mode === "search" || mode === "collection" || mode === "one" ? "shuffle" : mode;
      const r = await api.reel(m, query);
      if (r.photos?.length) setReel(r);
    } finally {
      setLoadingReel(false);
    }
  }

  const loadAll = useCallback(async () => {
    const [photos, cols] = await Promise.all([api.photos(), api.collections()]);
    setAll(photos);
    setCollections(cols);
  }, []);

  useEffect(() => {
    api.feed("shuffle").then(setFeed).catch(() => {});
    loadAll();
  }, [loadAll]);

  async function pickMode(m: string, label: string) {
    setMode(m);
    setActiveLabel(label);
    setQuery("");
    const f = await api.feed(m);
    setFeed(f.length ? f : all);
  }

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const results = await api.search(q);
      setFeed(results);
      setActiveLabel(`“${q}”`);
      setMode("search");
    } finally {
      setSearching(false);
    }
  }

  async function clearSearch() {
    setQuery("");
    setMode("shuffle");
    setActiveLabel("Shuffle");
    const f = await api.feed("shuffle");
    setFeed(f);
  }

  function focusPhoto(p: Photo) {
    setFeed((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pickYear(y: number | null) {
    setYear(y);
    if (y === null) {
      clearSearch();
      return;
    }
    const ph = all.filter((p) => p.takenAt && new Date(p.takenAt).getFullYear() === y);
    setFeed(ph);
    setActiveLabel(`${y}`);
    setMode("year");
  }

  async function deletePhoto(id: number) {
    if (!confirm("Delete this memory? This can't be undone.")) return;
    setAll((prev) => prev.filter((x) => x.id !== id));
    setFeed((prev) => prev.filter((x) => x.id !== id));
    try {
      await api.remove(id);
    } catch {
      /* ignore */
    }
    loadAll();
  }

  async function openCollection(c: Collection) {
    setFeed(c.photos);
    setActiveLabel(c.title);
    setMode("collection");
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(files.length);
    for (const f of Array.from(files)) {
      try {
        await api.upload(f);
      } catch {
        /* skip */
      }
      setUploading((n) => n - 1);
    }
    await loadAll();
    const f = await api.feed("shuffle");
    setFeed(f);
    setActiveLabel("Shuffle");
    setMode("shuffle");
  }

  return (
    <main className="grain relative min-h-screen bg-ink">
      <div className="aura-bg" />
      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <Logo size={46} />
          <div className="leading-none">
            <h1 className="bg-gradient-to-r from-cream via-gold to-ember bg-clip-text font-serif text-4xl font-semibold tracking-tight text-transparent md:text-5xl">
              Engram
            </h1>
            <span className="hidden text-[11px] uppercase tracking-[0.28em] text-cream/40 md:inline">
              your memories, connected
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAskOpen(true)}
            className="flex items-center gap-2 rounded-full border border-cream/15 px-4 py-2 text-sm text-cream/80 transition hover:text-cream"
          >
            <MessageCircle className="h-4 w-4" /> <span className="hidden sm:inline">Ask</span>
          </button>
          <button
            onClick={playReel}
            className="flex items-center gap-2 rounded-full border border-cream/15 px-4 py-2 text-sm text-cream/80 transition hover:text-cream"
          >
            <Play className="h-4 w-4" /> <span className="hidden sm:inline">{loadingReel ? "…" : "Reel"}</span>
          </button>
          <Link
            href="/graph"
            className="flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm text-gold transition hover:bg-gold/20"
          >
            <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Graph</span>
          </Link>
          <Link
            href="/city"
            className="flex items-center gap-2 rounded-full border border-ember/30 bg-ember/10 px-4 py-2 text-sm text-ember transition hover:bg-ember/20"
          >
            <Building2 className="h-4 w-4" /> <span className="hidden sm:inline">City</span>
          </Link>
          <Link
            href="/reminisce"
            className="flex items-center gap-2 rounded-full border border-cream/15 px-4 py-2 text-sm text-cream/80 transition hover:text-cream"
          >
            <Heart className="h-4 w-4" /> <span className="hidden sm:inline">Reminisce</span>
          </Link>
          <Link
            href="/frame"
            className="flex items-center gap-2 rounded-full border border-cream/15 px-4 py-2 text-sm text-cream/80 transition hover:text-cream"
          >
            <Tv className="h-4 w-4" /> <span className="hidden sm:inline">Cast</span>
          </Link>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-full bg-cream/10 px-4 py-2 text-sm text-cream transition hover:bg-cream/20"
          >
            <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Add</span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </nav>

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        {/* AI insights */}
        <Insights photos={all} />

        {/* Search */}
        <div className="glass mb-5 flex items-center gap-3 rounded-2xl px-4 py-3">
          <Search className="h-5 w-5 text-cream/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch(query)}
            placeholder="Search your memories…  e.g. “sunsets by the water”, “celebrations”"
            className="flex-1 bg-transparent text-cream placeholder:text-cream/30 focus:outline-none"
          />
          {query && (
            <button onClick={() => runSearch(query)} className="rounded-full bg-ember px-4 py-1.5 text-sm text-ink">
              {searching ? "…" : "Recall"}
            </button>
          )}
        </div>

        {/* Search results */}
        {mode === "search" && (
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-xl text-cream">
                {feed.length} {feed.length === 1 ? "memory" : "memories"} for{" "}
                <span className="text-ember">{activeLabel}</span>
              </h2>
              <button onClick={clearSearch} className="text-sm text-cream/60 hover:text-cream">
                Clear search
              </button>
            </div>
            {feed.length === 0 ? (
              <p className="glass rounded-2xl p-6 text-cream/50">
                No memories matched — try different words.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {feed.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => focusPhoto(p)}
                    className="group relative aspect-square overflow-hidden rounded-xl text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption} className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                    <p className="absolute inset-x-2 bottom-2 line-clamp-2 text-xs text-cream/90">{p.caption}</p>
                    {typeof p.score === "number" && (
                      <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-ember">
                        {Math.round(p.score * 100)}% match
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Mode pills */}
        <div className="mb-5 flex items-center gap-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => pickMode(m.key, m.label)}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                mode === m.key
                  ? "bg-cream text-ink"
                  : "border border-cream/15 text-cream/70 hover:text-cream"
              }`}
            >
              {m.label}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1.5 text-sm text-cream/50">
            <Sparkles className="h-4 w-4 text-ember" /> {activeLabel}
          </span>
        </div>

        {/* Timeline scrubber */}
        <Timeline photos={all} active={year} onPick={pickYear} />

        {/* The Frame */}
        <div className="group">
          <Frame photos={feed} />
        </div>

        {/* Concept constellation — a map of the concepts Cognee extracted */}
        <ConceptConstellation onFocus={focusPhoto} />

        {/* Collections */}
        {collections.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 font-serif text-2xl text-cream">Collections</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {collections.map((c) => (
                <motion.button
                  key={c.key}
                  whileHover={{ y: -3 }}
                  onClick={() => openCollection(c)}
                  className="group relative h-40 overflow-hidden rounded-2xl text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.cover} alt={c.title} className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-3 left-3">
                    <p className="font-serif text-lg text-cream">{c.title}</p>
                    <p className="text-xs text-cream/60">{c.count} memories</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        )}

        {/* Gallery */}
        {all.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 font-serif text-2xl text-cream">All memories</h2>
            <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
              {all.map((p) => (
                <div key={p.id} className="group relative mb-4 break-inside-avoid overflow-hidden rounded-xl">
                  <button
                    onClick={() => {
                      setFeed([p, ...all.filter((x) => x.id !== p.id)]);
                      setActiveLabel("Selected");
                      setMode("one");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="block w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption} className="w-full transition group-hover:opacity-90" />
                  </button>
                  <button
                    onClick={() => deletePhoto(p.id)}
                    title="Delete memory"
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-cream/80 opacity-0 backdrop-blur transition hover:bg-red-500/80 hover:text-white group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-16 border-t border-cream/10 pb-4 pt-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Logo size={22} />
            <span className="font-serif text-xl text-cream/80">Engram</span>
          </div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-cream/30">
            where moments become memories
          </p>
          <p className="mt-3 text-xs text-cream/30">
            © 2026 Engram · a self-hosted memory graph, powered by Cognee
          </p>
        </footer>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {askOpen && <AskPanel onClose={() => setAskOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {reel && <Reel title={reel.title} photos={reel.photos} onClose={() => setReel(null)} />}
      </AnimatePresence>

      {/* Upload toast */}
      {uploading > 0 && (
        <div className="glass fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-sm text-cream">
          <Sparkles className="h-4 w-4 animate-pulse text-ember" />
          Understanding {uploading} photo{uploading > 1 ? "s" : ""}…
        </div>
      )}
    </main>
  );
}
