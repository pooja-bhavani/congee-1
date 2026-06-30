const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type Photo = {
  id: number;
  url: string;
  caption: string;
  scene: string;
  mood: string;
  tags: string[];
  people: number;
  palette: string[];
  takenAt: string | null;
  favorite: boolean;
  score?: number;
};

export type Collection = {
  key: string;
  title: string;
  description: string;
  cover: string;
  count: number;
  photos: Photo[];
};

export type GraphNode = { id: string; label: string; type: string; source: string };
export type GraphEdge = { source: string; target: string; rel: string };
export type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] };
export type ImproveResult = {
  before: { nodes: number; edges: number };
  after: { nodes: number; edges: number };
  gained: { nodes: number; edges: number };
};

export type Concept = { name: string; count: number; photoIds: number[] };
export type Connection = { photo: Photo; shared: string[]; count: number };
export type ThreadStep = { photo: Photo; narration: string; connect: string | null; shared: string[] };
export type Forgotten = { found: boolean; a?: Photo; b?: Photo; shared?: string[] };

const OWNER = "me";

async function jget<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}

export const api = {
  base: API,

  photos: () => jget<Photo[]>(`/api/photos?owner=${OWNER}`),

  collections: () => jget<Collection[]>(`/api/collections?owner=${OWNER}`),

  map: () => jget<(Photo & { x: number; y: number })[]>(`/api/map?owner=${OWNER}`),

  onThisDay: () => jget<Photo[]>(`/api/on-this-day?owner=${OWNER}`),

  feed: (mode: string, query = "") =>
    jget<Photo[]>(`/api/frame/feed?owner=${OWNER}&mode=${mode}&query=${encodeURIComponent(query)}`),

  search: async (query: string): Promise<Photo[]> => {
    const res = await fetch(`${API}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, owner: OWNER, limit: 30 }),
    });
    return res.json();
  },

  story: (id: number) => jget<{ story: string }>(`/api/frame/story/${id}`),

  // ?v busts any audio your browser cached from before the single-voice fix.
  narrateUrl: (id: number) => `${API}/api/narrate/${id}?v=ruth1`,

  ask: async (
    question: string,
    mode = "graph",
  ): Promise<{ answer: string; photos: Photo[]; qa_id: string | null; mode: string }> => {
    const res = await fetch(`${API}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, owner: OWNER, mode }),
    });
    return res.json();
  },

  feedback: (qa_id: string, score: number) =>
    fetch(`${API}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qa_id, score }),
    }).then((r) => r.json()),

  reel: async (mode = "shuffle", query = ""): Promise<{ title: string; photos: (Photo & { line: string })[] }> => {
    const res = await fetch(`${API}/api/reel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: OWNER, mode, query, limit: 8 }),
    });
    return res.json();
  },

  favorite: (id: number) =>
    fetch(`${API}/api/photos/${id}/favorite`, { method: "POST" }).then((r) => r.json()),

  remove: (id: number) =>
    fetch(`${API}/api/photos/${id}`, { method: "DELETE" }).then((r) => r.json()),

  upload: async (file: File): Promise<Photo> => {
    const form = new FormData();
    form.append("file", file);
    form.append("owner", OWNER);
    const res = await fetch(`${API}/api/photos`, { method: "POST", body: form });
    if (!res.ok) throw new Error("upload failed");
    return res.json();
  },

  // --- Cognee knowledge-graph lifecycle ---
  health: () => jget<{ status: string; nodes: number; edges: number }>(`/health`),

  graph: () => jget<GraphData>(`/api/graph`),

  concepts: (limit = 40) => jget<Concept[]>(`/api/concepts?limit=${limit}`),

  connections: (id: number) => jget<Connection[]>(`/api/photos/${id}/connections`),

  reminisceThread: (start?: number) =>
    jget<{ thread: ThreadStep[] }>(`/api/reminisce/thread${start ? `?start=${start}` : ""}`),

  forgottenConnection: () => jget<Forgotten>(`/api/forgotten-connection`),

  recall: async (query: string): Promise<{ answer: string; photos: Photo[] }> => {
    const res = await fetch(`${API}/api/recall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, owner: OWNER }),
    });
    return res.json();
  },

  improve: async (): Promise<ImproveResult> => {
    const res = await fetch(`${API}/api/improve`, { method: "POST" });
    if (!res.ok) throw new Error("improve failed");
    return res.json();
  },

  forget: (id: number) =>
    fetch(`${API}/api/forget/${id}`, { method: "POST" }).then((r) => r.json()),
};
