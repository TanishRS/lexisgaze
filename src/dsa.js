import { DOC_MAP, SERVER_COUNT, djb2 } from "./data.js";

// ─────────────────────────────────────────────────────────────────────────
// (a) Keyword Folder View  →  HashMap (tag/keyword -> Set of doc ids)
// Inverted index that groups documents by their tags and folders. O(1) lookup
// per keyword, O(N·T) to build.
// ─────────────────────────────────────────────────────────────────────────
export function buildKeywordIndex(docs) {
  const tagIndex = new Map(); // tag -> Set(docId)
  const folderIndex = new Map(); // folder -> Set(docId)
  for (const d of docs) {
    for (const t of d.tags) {
      if (!tagIndex.has(t)) tagIndex.set(t, new Set());
      tagIndex.get(t).add(d.id);
    }
    if (!folderIndex.has(d.folder)) folderIndex.set(d.folder, new Set());
    folderIndex.get(d.folder).add(d.id);
  }
  return { tagIndex, folderIndex };
}

// ─────────────────────────────────────────────────────────────────────────
// (b) Index Change History  →  Stack (LIFO) for undo
// Each tag edit pushes the previous state; undo pops it back.
// ─────────────────────────────────────────────────────────────────────────
export class HistoryStack {
  constructor() {
    this.stack = [];
  }
  push(entry) {
    this.stack.push(entry); // entry: { docId, prevTags, nextTags, when }
  }
  pop() {
    return this.stack.pop();
  }
  peek() {
    return this.stack[this.stack.length - 1] ?? null;
  }
  get size() {
    return this.stack.length;
  }
  toArray() {
    // newest first for display
    return [...this.stack].reverse();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// (c) Background Indexer  →  Queue (FIFO) — process in upload order
// ─────────────────────────────────────────────────────────────────────────
export class IndexQueue {
  constructor() {
    this.items = [];
  }
  enqueue(docId) {
    this.items.push(docId);
  }
  dequeue() {
    return this.items.shift(); // front of queue
  }
  get size() {
    return this.items.length;
  }
  toArray() {
    return [...this.items];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// (d) File Integrity Checker  →  Hash Table lookup, O(1)
// Verify a document's stored checksum against a freshly computed one.
// ─────────────────────────────────────────────────────────────────────────
export function verifyIntegrity(doc) {
  const recomputed = djb2(doc.id + doc.content);
  return { recomputed, stored: doc.checksum, ok: recomputed === doc.checksum };
}

// ─────────────────────────────────────────────────────────────────────────
// (e) Relevance Sorter  →  Sorting by term frequency
// Count occurrences of the query term in title + content, then sort desc.
// ─────────────────────────────────────────────────────────────────────────
export function rankByRelevance(docs, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = docs.map((d) => {
    const haystack = (d.title + " " + d.content + " " + d.tags.join(" ")).toLowerCase();
    let count = 0;
    let idx = haystack.indexOf(q);
    while (idx !== -1) {
      count++;
      idx = haystack.indexOf(q, idx + q.length);
    }
    return { doc: d, score: count };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id));
}

// ─────────────────────────────────────────────────────────────────────────
// (f) Citation Map Hub  →  Graph (adjacency list)
// Build a directed graph from the `cites` arrays.
// ─────────────────────────────────────────────────────────────────────────
export function buildCitationGraph(docs) {
  const adj = new Map(); // docId -> [citedIds]
  for (const d of docs) adj.set(d.id, [...d.cites]);
  return adj;
}

// ─────────────────────────────────────────────────────────────────────────
// (g) Quick Reference Finder  →  BFS shortest path on the citation graph
// Returns the path (list of ids) or null if unreachable. Treats the graph as
// undirected for "reachable through citations" navigation.
// ─────────────────────────────────────────────────────────────────────────
export function shortestCitationPath(adj, start, goal) {
  if (start === goal) return [start];
  // build undirected view
  const undirected = new Map();
  for (const [k] of adj) undirected.set(k, new Set());
  for (const [k, list] of adj) {
    for (const v of list) {
      undirected.get(k).add(v);
      if (!undirected.has(v)) undirected.set(v, new Set());
      undirected.get(v).add(k);
    }
  }
  const queue = [[start]];
  const visited = new Set([start]);
  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];
    for (const next of undirected.get(node) ?? []) {
      if (visited.has(next)) continue;
      const newPath = [...path, next];
      if (next === goal) return newPath;
      visited.add(next);
      queue.push(newPath);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// (h) Search Data Balancer  →  Consistent hashing / partitioning
// Distribute each document's index shard across N servers by hashing its id.
// ─────────────────────────────────────────────────────────────────────────
export function partitionAcrossServers(docs, serverCount = SERVER_COUNT) {
  const servers = Array.from({ length: serverCount }, (_, i) => ({
    id: i,
    name: `shard-${i}`,
    docs: [],
  }));
  for (const d of docs) {
    const h = parseInt(djb2(d.id), 16);
    const server = h % serverCount;
    servers[server].docs.push(d.id);
  }
  return servers;
}

export { DOC_MAP };
