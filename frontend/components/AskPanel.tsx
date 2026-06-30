"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { api, type Photo } from "@/lib/api";

type Turn = { q: string; answer: string; photos: Photo[]; qaId: string | null; rated: number | null };

const PROMPTS = [
  "What did I do near the water?",
  "Show me my happiest memories",
  "Tell me about my travels",
];

const MODES: { key: string; label: string; hint: string }[] = [
  { key: "graph", label: "Graph", hint: "graph-grounded answer" },
  { key: "reason", label: "Reason", hint: "chain-of-thought over the graph" },
  { key: "summary", label: "Summary", hint: "summarized across memories" },
];

export function AskPanel({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("graph");

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setLoading(true);
    setQ("");
    try {
      const res = await api.ask(question, mode);
      setTurns((t) => [...t, { q: question, answer: res.answer, photos: res.photos, qaId: res.qa_id, rated: null }]);
    } finally {
      setLoading(false);
    }
  }

  async function rate(idx: number, score: number) {
    const t = turns[idx];
    if (!t.qaId || t.rated) return;
    setTurns((cur) => cur.map((x, i) => (i === idx ? { ...x, rated: score } : x)));
    try {
      await api.feedback(t.qaId, score);
    } catch {
      /* best-effort */
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: 480 }}
        animate={{ x: 0 }}
        exit={{ x: 480 }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-surface"
      >
        <header className="flex items-center justify-between border-b border-cream/10 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-ember" />
            <h2 className="font-serif text-xl text-cream">Talk to your memories</h2>
          </div>
          <button onClick={onClose} className="text-cream/50 hover:text-cream">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {turns.length === 0 && (
            <div className="space-y-3 pt-4">
              <p className="text-sm text-cream/50">Ask anything about your photos:</p>
              {PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => ask(p)}
                  className="block w-full rounded-xl border border-cream/10 bg-cream/5 px-4 py-3 text-left text-sm text-cream/80 transition hover:border-ember/40"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {turns.map((t, idx) => (
            <div key={idx} className="space-y-3">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-ember/20 px-4 py-2 text-sm text-cream">
                {t.q}
              </p>
              <div className="rounded-2xl rounded-tl-sm bg-cream/5 p-4">
                <p className="text-sm leading-relaxed text-cream/90">{t.answer}</p>
                {t.photos.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {t.photos.slice(0, 5).map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p.id} src={p.url} alt={p.caption} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
                {/* Feedback → the memory learns from your rating (Cognee improve) */}
                {t.qaId && (
                  <div className="mt-3 flex items-center gap-3 border-t border-cream/10 pt-2 text-xs">
                    {t.rated ? (
                      <span className="text-ember">
                        {t.rated >= 4 ? "👍 thanks — your memory just got smarter" : "👎 noted — refining your memory"}
                      </span>
                    ) : (
                      <>
                        <span className="text-cream/40">was this right?</span>
                        <button onClick={() => rate(idx, 5)} className="text-cream/60 transition hover:text-ember" title="good answer — reinforce">
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                        <button onClick={() => rate(idx, 1)} className="text-cream/60 transition hover:text-gold" title="off — down-weight">
                          <ThumbsDown className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <p className="flex items-center gap-2 text-sm text-cream/50">
              <Sparkles className="h-4 w-4 animate-pulse text-ember" /> remembering…
            </p>
          )}
        </div>

        <div className="border-t border-cream/10 p-4">
          <div className="mb-2 flex items-center gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                title={m.hint}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  mode === m.key ? "bg-gold/20 text-cream" : "text-cream/45 hover:text-cream/70"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-cream/5 px-3 py-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask(q)}
              placeholder="Ask about your memories…"
              className="flex-1 bg-transparent text-sm text-cream placeholder:text-cream/30 focus:outline-none"
            />
            <button onClick={() => ask(q)} className="text-ember disabled:opacity-40" disabled={!q.trim()}>
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.aside>
    </motion.div>
  );
}
