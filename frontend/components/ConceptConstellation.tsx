"use client";

import { useEffect, useRef, useState } from "react";
import { api, type Concept, type Connection, type Photo } from "@/lib/api";

// Vivid aurora palette (distinct from the graph view's violet/cyan dots).
const PALETTE = ["#ff6ec7", "#ffd166", "#4ade80", "#38e8d0", "#7c5cff", "#5ce0ff", "#fb923c", "#f472b6"];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** A live, physics-driven map of your mind: the concepts Cognee extracted from
 * your memories, sized by recurrence and linked where they co-occur. Drag a
 * concept and the whole web responds; click one to reveal its memories. */
export function ConceptConstellation({ onFocus }: { onFocus?: (p: Photo) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<any>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [photos, setPhotos] = useState<Record<number, Photo>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectFor, setConnectFor] = useState<Photo | null>(null);
  const [connections, setConnections] = useState<Connection[] | null>(null);

  const showConnections = async (p: Photo) => {
    if (connectFor?.id === p.id) {
      setConnectFor(null);
      setConnections(null);
      return;
    }
    setConnectFor(p);
    setConnections(null);
    try {
      setConnections(await api.connections(p.id));
    } catch {
      setConnections([]);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [cs, ps] = await Promise.all([api.concepts(55), api.photos()]);
        setConcepts(cs);
        setPhotos(Object.fromEntries(ps.map((p) => [p.id, p])));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!containerRef.current || concepts.length === 0) return;
      const vis = await import("vis-network/standalone");
      if (disposed || !containerRef.current) return;

      const max = concepts[0]?.count || 1;
      const nodes = concepts.map((c) => {
        const col = colorFor(c.name);
        return {
          id: c.name,
          label: c.name,
          value: c.count,
          shape: "star",
          size: 12 + (c.count / max) * 36,
          color: { background: col, border: "#e8e9f2", highlight: { background: "#fff", border: col } },
          font: { color: "#dfe2f0", size: 13 + (c.count / max) * 9, face: "Inter, sans-serif" },
          shadow: { enabled: true, color: col, size: 18, x: 0, y: 0 },
        };
      });

      // Co-occurrence edges: concepts that share at least one memory.
      const edges: any[] = [];
      for (let i = 0; i < concepts.length; i++) {
        for (let j = i + 1; j < concepts.length; j++) {
          const shared = concepts[i].photoIds.filter((id) => concepts[j].photoIds.includes(id)).length;
          if (shared > 0) {
            edges.push({
              from: concepts[i].name,
              to: concepts[j].name,
              value: shared,
              width: 0.4 + shared * 0.7,
              color: { color: "rgba(124,92,255,0.18)", highlight: "#38e8d0" },
              smooth: { enabled: true, type: "continuous", roundness: 0.4 },
            });
          }
        }
      }

      const network = new vis.Network(
        containerRef.current,
        { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) },
        {
          physics: {
            enabled: true,
            stabilization: { iterations: 150 },
            barnesHut: { gravitationalConstant: -7000, springLength: 130, springConstant: 0.035, damping: 0.4 },
          },
          interaction: { hover: true, dragNodes: true, tooltipDelay: 120, navigationButtons: false },
          nodes: { borderWidth: 1.5 },
        },
      );
      network.on("click", (params: any) => {
        const id = params.nodes?.[0];
        setSelected(id ? String(id) : null);
        setConnectFor(null);
        setConnections(null);
      });
      networkRef.current = network;
    })();
    return () => {
      disposed = true;
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [concepts]);

  const selectedConcept = selected ? concepts.find((c) => c.name === selected) : null;
  const selectedPhotos = selectedConcept
    ? selectedConcept.photoIds.map((id) => photos[id]).filter(Boolean)
    : [];

  return (
    <section className="mt-12">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-serif text-2xl text-cream">Concept Constellation</h2>
        <span className="text-xs uppercase tracking-[0.2em] text-cream/40">
          a living map of your mind · {concepts.length} concepts · drag to explore
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-cream/10 bg-gradient-to-b from-[#0c0f1e] to-[#080a14]">
        <div ref={containerRef} className="h-[560px] w-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-stone-400">
            mapping your concepts…
          </div>
        )}
        {!loading && concepts.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-stone-400">
            add a few photos and your concept map will appear here.
          </div>
        )}
        {!selected && !loading && concepts.length > 0 && (
          <div className="pointer-events-none absolute bottom-3 left-4 text-xs text-cream/35">
            click a concept to see its memories · drag any node to feel the web
          </div>
        )}
      </div>

      {selected && selectedConcept && (
        <div className="mt-4 rounded-2xl border border-gold/20 bg-gold/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="text-cream/60">memories tagged</span>
            <span className="rounded-full bg-gold/20 px-3 py-0.5 font-medium text-cream">{selected}</span>
            <span className="text-cream/40">· {selectedPhotos.length}</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {selectedPhotos.map((p) => (
              <button
                key={p.id}
                onClick={() => showConnections(p)}
                onDoubleClick={() => onFocus?.(p)}
                className={`group relative h-24 w-32 shrink-0 overflow-hidden rounded-xl border transition ${
                  connectFor?.id === p.id ? "border-ember ring-2 ring-ember/40" : "border-cream/10"
                }`}
                title={`${p.caption}\n(click: see connections · double-click: open)`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption} className="h-full w-full object-cover transition group-hover:scale-105" />
              </button>
            ))}
          </div>

          {connectFor && (
            <div className="mt-4 border-t border-cream/10 pt-4">
              <div className="mb-2 text-sm text-cream/60">
                🔗 memories connected to{" "}
                <span className="text-cream">“{connectFor.caption.slice(0, 40)}…”</span>
                {connections && <span className="text-cream/40"> · {connections.length}</span>}
              </div>
              {!connections && <div className="text-sm text-cream/40">tracing the graph…</div>}
              {connections && connections.length === 0 && (
                <div className="text-sm text-cream/40">no shared-concept connections yet.</div>
              )}
              <div className="flex gap-3 overflow-x-auto pb-1">
                {(connections || []).map((c) => (
                  <button
                    key={c.photo.id}
                    onClick={() => onFocus?.(c.photo)}
                    className="group relative h-24 w-32 shrink-0 overflow-hidden rounded-xl border border-ember/20"
                    title={c.photo.caption}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.photo.url} alt={c.photo.caption} className="h-full w-full object-cover transition group-hover:scale-105" />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 text-[10px] text-ember">
                      {c.shared.slice(0, 3).join(", ")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
