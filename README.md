# LexisGaze

> Internal document search tool — organises documents by tags and folders, and shows the most relevant results first.

**Problem statement #39 — ITM Skills University**
Build a search tool for a company's internal documents. It needs to organise documents by tags and folders and show the most relevant results first.

## Live demo

- **Live link:** _<add your Vercel/Netlify URL here>_
- **Repository:** _<add your GitHub URL here>_

## Tech stack

| Layer    | Choice                          |
| -------- | ------------------------------- |
| Framework| React 18                        |
| Build    | Vite 5                          |
| Styling  | Hand-written CSS (in-component) |
| Icons    | lucide-react                    |
| Data     | Local mock corpus (10 docs)     |

No backend is required — per the submission guidelines, the corpus is an in-memory mock so the evaluation focuses on React + DSA skills.

## The 8 "Must Have" features and the data structures behind them

Every feature maps to a specific data structure or algorithm, all implemented in `src/dsa.js` (kept separate from the UI so the DSA is easy to point at during the viva).

| # | Feature              | Data structure / algorithm        | Where                         |
|---|----------------------|------------------------------------|-------------------------------|
| a | Keyword Folder View  | HashMap inverted index (tag→docs)  | `buildKeywordIndex`           |
| b | Index Change History | Stack (LIFO undo)                  | `HistoryStack`                |
| c | Background Indexer   | Queue (FIFO, upload order)         | `IndexQueue`                  |
| d | File Integrity Checker| Hash table + DJB2 checksum, O(1)  | `verifyIntegrity`             |
| e | Relevance Sorter     | Sorting by term frequency          | `rankByRelevance`             |
| f | Citation Map Hub     | Directed graph (adjacency list)    | `buildCitationGraph`          |
| g | Quick Reference Finder| BFS shortest path                 | `shortestCitationPath`        |
| h | Search Data Balancer | Consistent hashing / partitioning  | `partitionAcrossServers`      |

## Features in detail

- **Relevance Search** — counts how often the term appears in title, content, and tags, then sorts results highest-first with a visible hit count.
- **Keyword Folders** — click any folder or tag to list its documents instantly (O(1) index lookup).
- **Change History** — toggle a document's tags; each edit is pushed onto a stack and can be undone one step at a time.
- **Background Indexer** — documents wait in a FIFO queue and move to "indexed" in upload order; step through one at a time or process all.
- **Integrity Checker** — verifies the stored checksum against a freshly computed one; "Simulate corruption" demonstrates a mismatch.
- **Citation Map** — a circular SVG graph of cross-references plus the adjacency list; hovering highlights a node's edges.
- **Quick Reference** — pick two documents and BFS returns the fewest-hop path through citations (or reports no path).
- **Data Balancer** — shows how each document's shard hashes onto one of 3 servers, with load bars.

## Setup

Another developer can run this without help:

```bash
git clone <your-repo-url>
cd lexisgaze
npm install
npm run dev      # http://localhost:5173
```

Build for production:

```bash
npm run build    # outputs to dist/
npm run preview
```

## Screenshots

_Add screenshots of the Relevance Search, Citation Map, and Integrity Checker views here before submitting._

## Project structure

```
lexisgaze/
├─ index.html
├─ package.json
├─ vite.config.js
└─ src/
   ├─ main.jsx     # React entry point
   ├─ App.jsx      # UI: all 8 feature views + styling
   ├─ dsa.js       # data structures & algorithms (the graded core)
   └─ data.js      # mock document corpus + checksum helper
```

## Notes

- Built with React.js; no router needed (single-page tabbed UI). Axios/Router/Tailwind were optional per guidelines and not required here.
- All work is original; no UI cloning.
