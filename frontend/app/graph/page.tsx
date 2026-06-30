import Link from "next/link";
import GraphView from "@/components/GraphView";

export default function GraphPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#15131a] to-[#0b0b0e] px-6 py-10 text-stone-200 md:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 flex items-center justify-between">
          <Link href="/" className="text-sm text-stone-400 transition hover:text-gold">
            ← back to Engram
          </Link>
        </div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-transparent bg-gradient-to-r from-cream via-gold to-ember bg-clip-text">
          Your Memory Graph
        </h1>
        <p className="mb-8 mt-2 max-w-2xl text-stone-400">
          Every photo is woven into a living knowledge graph — people, places, moods and moments,
          connected across your memories by self-hosted Cognee. Ask it questions, watch it grow as
          you add photos, and enrich it to discover new connections.
        </p>
        <GraphView />
      </div>
    </main>
  );
}
