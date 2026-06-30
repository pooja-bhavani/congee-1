"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, type GraphData, type ImproveResult } from "@/lib/api";

// Engram neural palette (violet/cyan family) cycled per source photo.
const PALETTE = [
  "#7c5cff", "#38e8d0", "#9b7cff", "#5ce0ff", "#c084fc",
  "#6ee7b7", "#818cf8", "#22d3ee", "#a78bfa", "#34d399",
];

function colorFor(source: string): string {
  if (source === "shared" || !source) return "#6f6a60";
  let h = 0;
  for (let i = 0; i < source.length; i++) h = (h * 31 + source.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<any>(null);
  const [data, setData] = useState<GraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [gained, setGained] = useState<ImproveResult["gained"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const g = await api.graph();
      setData(g);
      setError(null);
    } catch (e) {
      setError("Could not load the memory graph yet — upload a photo first.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Render / update the vis-network graph whenever data changes.
  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!containerRef.current || data.nodes.length === 0) return;
      const vis = await import("vis-network/standalone");
      if (disposed || !containerRef.current) return;

      const nodes = data.nodes.map((n) => {
        const isPhoto = n.type === "Photo";
        return {
          id: n.id,
          label: n.label,
          shape: isPhoto ? "star" : "dot",
          size: isPhoto ? 26 : 12,
          color: {
            background: colorFor(n.source),
            border: isPhoto ? "#f5f0e6" : colorFor(n.source),
            highlight: { background: "#f5f0e6", border: colorFor(n.source) },
          },
          font: { color: "#e9e2d4", size: isPhoto ? 16 : 11, face: "Inter, sans-serif" },
        };
      });
      const edges = data.edges.map((e) => ({
        from: e.source,
        to: e.target,
        color: { color: "rgba(245,240,230,0.14)", highlight: "#e0b66e" },
        width: 0.6,
        smooth: { enabled: true, type: "continuous", roundness: 0.5 },
      }));

      const network = new vis.Network(
        containerRef.current,
        { nodes: new vis.DataSet(nodes as any), edges: new vis.DataSet(edges as any) },
        {
          physics: {
            stabilization: { iterations: 120 },
            barnesHut: { gravitationalConstant: -4000, springLength: 120, springConstant: 0.03 },
          },
          interaction: { hover: true, tooltipDelay: 120 },
          nodes: { borderWidth: 1.5 },
        },
      );
      networkRef.current = network;
    })();
    return () => {
      disposed = true;
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [data]);

  const enrich = async () => {
    setEnriching(true);
    setGained(null);
    try {
      const res = await api.improve();
      setGained(res.gained);
      await load();
    } catch {
      setError("Enrichment failed — check the backend logs.");
    } finally {
      setEnriching(false);
    }
  };

  const photoCount = useMemo(
    () => data.nodes.filter((n) => n.type === "Photo").length,
    [data],
  );

  return (
    <div className="relative w-full">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="text-sm text-stone-300">
          <span className="font-semibold text-gold">{data.nodes.length}</span> memories &amp; concepts ·{" "}
          <span className="font-semibold text-gold">{data.edges.length}</span> connections ·{" "}
          <span className="font-semibold text-gold">{photoCount}</span> photos
        </div>
        <button
          onClick={enrich}
          disabled={enriching}
          className="rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-sm text-cream transition hover:bg-gold/20 disabled:opacity-50"
        >
          {enriching ? "Enriching memories…" : "✨ Enrich my memories"}
        </button>
        {gained && (
          <span className="text-sm text-ember">
            +{gained.nodes} concepts, +{gained.edges} connections
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="h-[560px] w-full rounded-2xl border border-stone-100/10 bg-[#0d0c10]"
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-stone-400">
          weaving your memory graph…
        </div>
      )}
      {error && !loading && data.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-stone-400">
          {error}
        </div>
      )}
    </div>
  );
}
