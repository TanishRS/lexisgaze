import { useState, useMemo, useRef } from "react";
import {
  FolderTree,
  History,
  ListOrdered,
  ShieldCheck,
  ArrowDownWideNarrow,
  Network,
  Route,
  Server,
  Search,
  Undo2,
  Play,
  Check,
  X,
} from "lucide-react";
import { DOCUMENTS, DOC_MAP, SERVER_COUNT } from "./data.js";
import {
  buildKeywordIndex,
  HistoryStack,
  IndexQueue,
  verifyIntegrity,
  rankByRelevance,
  buildCitationGraph,
  shortestCitationPath,
  partitionAcrossServers,
} from "./dsa.js";

const FEATURES = [
  { key: "search", label: "Relevance Search", ds: "Term-frequency sort", icon: Search },
  { key: "folders", label: "Keyword Folders", ds: "HashMap index", icon: FolderTree },
  { key: "history", label: "Change History", ds: "Stack · undo", icon: History },
  { key: "indexer", label: "Background Indexer", ds: "Queue · FIFO", icon: ListOrdered },
  { key: "integrity", label: "Integrity Checker", ds: "Hash table O(1)", icon: ShieldCheck },
  { key: "citations", label: "Citation Map", ds: "Graph · adjacency list", icon: Network },
  { key: "path", label: "Quick Reference", ds: "BFS shortest path", icon: Route },
  { key: "balancer", label: "Data Balancer", ds: "Consistent hashing", icon: Server },
];

export default function App() {
  const [tab, setTab] = useState("search");
  // documents live in state so tag edits + integrity tampering are reactive
  const [docs, setDocs] = useState(() => DOCUMENTS.map((d) => ({ ...d })));
  const historyRef = useRef(new HistoryStack());
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const active = FEATURES.find((f) => f.key === tab);

  return (
    <div className="lg-root">
      <Style />
      <header className="lg-header">
        <div className="lg-mark">§</div>
        <div>
          <h1>LexisGaze</h1>
          <p className="lg-sub">
            Internal document search · organised by tags &amp; folders, ranked most-relevant first
          </p>
        </div>
        <div className="lg-corpus">{docs.length} docs indexed</div>
      </header>

      <nav className="lg-nav" aria-label="Features">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <button
              key={f.key}
              className={"lg-tab" + (tab === f.key ? " is-active" : "")}
              onClick={() => setTab(f.key)}
            >
              <Icon size={16} strokeWidth={2} />
              <span>{f.label}</span>
            </button>
          );
        })}
      </nav>

      <main className="lg-main">
        <div className="lg-feature-head">
          <h2>{active.label}</h2>
          <code className="lg-ds-pill">{active.ds}</code>
        </div>

        {tab === "search" && <RelevanceSearch docs={docs} />}
        {tab === "folders" && <KeywordFolders docs={docs} />}
        {tab === "history" && (
          <ChangeHistory docs={docs} setDocs={setDocs} history={historyRef.current} rerender={rerender} />
        )}
        {tab === "indexer" && <BackgroundIndexer docs={docs} />}
        {tab === "integrity" && <IntegrityChecker docs={docs} setDocs={setDocs} />}
        {tab === "citations" && <CitationMap docs={docs} />}
        {tab === "path" && <QuickReference docs={docs} />}
        {tab === "balancer" && <DataBalancer docs={docs} />}
      </main>

      <footer className="lg-footer">
        LexisGaze · 8 DSA-mapped features · ITM Skills University
      </footer>
    </div>
  );
}

/* ───────────────────────── (e) Relevance Sorter ───────────────────────── */
function RelevanceSearch({ docs }) {
  const [q, setQ] = useState("compliance");
  const results = useMemo(() => rankByRelevance(docs, q), [docs, q]);
  return (
    <div>
      <div className="lg-searchbar">
        <Search size={18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a term — results rank by how often it appears"
          aria-label="Search documents"
        />
      </div>
      {q.trim() === "" ? (
        <Empty>Type a term to search the corpus.</Empty>
      ) : results.length === 0 ? (
        <Empty>No documents contain “{q}”. Try a tag like “security” or “sales”.</Empty>
      ) : (
        <ol className="lg-results">
          {results.map(({ doc, score }, i) => (
            <li key={doc.id} className="lg-result">
              <span className="lg-rank">{i + 1}</span>
              <div className="lg-result-body">
                <div className="lg-result-title">
                  {doc.title} <span className="lg-id">{doc.id}</span>
                </div>
                <div className="lg-result-meta">
                  <span className="lg-folder-chip">{doc.folder}</span>
                  {doc.tags.map((t) => (
                    <span key={t} className="lg-tag">#{t}</span>
                  ))}
                </div>
              </div>
              <div className="lg-score" title="term frequency">
                <strong>{score}</strong>
                <span>hits</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ──────────────────────── (a) Keyword Folder View ─────────────────────── */
function KeywordFolders({ docs }) {
  const { tagIndex, folderIndex } = useMemo(() => buildKeywordIndex(docs), [docs]);
  const [selected, setSelected] = useState(null); // {type, key}
  const selectedDocs = useMemo(() => {
    if (!selected) return [];
    const index = selected.type === "tag" ? tagIndex : folderIndex;
    return [...(index.get(selected.key) ?? [])].map((id) => DOC_MAP[id] || docs.find((d) => d.id === id));
  }, [selected, tagIndex, folderIndex, docs]);

  return (
    <div className="lg-two-col">
      <div>
        <h3 className="lg-h3">Folders</h3>
        <div className="lg-chips">
          {[...folderIndex.keys()].map((f) => (
            <button
              key={f}
              className={"lg-chip" + (selected?.type === "folder" && selected.key === f ? " is-active" : "")}
              onClick={() => setSelected({ type: "folder", key: f })}
            >
              {f} <em>{folderIndex.get(f).size}</em>
            </button>
          ))}
        </div>
        <h3 className="lg-h3" style={{ marginTop: 24 }}>Keywords / tags</h3>
        <div className="lg-chips">
          {[...tagIndex.keys()].sort().map((t) => (
            <button
              key={t}
              className={"lg-chip" + (selected?.type === "tag" && selected.key === t ? " is-active" : "")}
              onClick={() => setSelected({ type: "tag", key: t })}
            >
              #{t} <em>{tagIndex.get(t).size}</em>
            </button>
          ))}
        </div>
      </div>
      <div className="lg-panel">
        {!selected ? (
          <Empty>Pick a folder or keyword to list its documents.</Empty>
        ) : (
          <>
            <div className="lg-panel-head">
              {selected.type === "tag" ? `#${selected.key}` : selected.key}
            </div>
            {selectedDocs.map((d) => (
              <div key={d.id} className="lg-doc-line">
                <span className="lg-id">{d.id}</span> {d.title}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── (b) Index Change History ─────────────────────── */
const ALL_TAGS = ["policy", "compliance", "security", "sales", "engineering", "privacy", "draft", "archived"];
function ChangeHistory({ docs, setDocs, history, rerender }) {
  const [docId, setDocId] = useState(docs[0].id);
  const doc = docs.find((d) => d.id === docId);

  const toggleTag = (tag) => {
    const prevTags = [...doc.tags];
    const nextTags = prevTags.includes(tag)
      ? prevTags.filter((t) => t !== tag)
      : [...prevTags, tag];
    history.push({ docId, prevTags, nextTags, when: new Date().toLocaleTimeString() });
    setDocs((ds) => ds.map((d) => (d.id === docId ? { ...d, tags: nextTags } : d)));
    rerender();
  };

  const undo = () => {
    const last = history.pop();
    if (!last) return;
    setDocs((ds) => ds.map((d) => (d.id === last.docId ? { ...d, tags: last.prevTags } : d)));
    rerender();
  };

  return (
    <div className="lg-two-col">
      <div>
        <label className="lg-label">Document</label>
        <select className="lg-select" value={docId} onChange={(e) => setDocId(e.target.value)}>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>{d.id} — {d.title}</option>
          ))}
        </select>
        <label className="lg-label" style={{ marginTop: 18 }}>Toggle tags (each edit is recorded)</label>
        <div className="lg-chips">
          {ALL_TAGS.map((t) => (
            <button
              key={t}
              className={"lg-chip" + (doc.tags.includes(t) ? " is-active" : "")}
              onClick={() => toggleTag(t)}
            >
              #{t}
            </button>
          ))}
        </div>
        <button className="lg-btn" onClick={undo} disabled={history.size === 0} style={{ marginTop: 20 }}>
          <Undo2 size={16} /> Undo last change ({history.size})
        </button>
      </div>
      <div className="lg-panel">
        <div className="lg-panel-head">Change log — stack, newest on top</div>
        {history.size === 0 ? (
          <Empty>No changes yet. Toggle a tag to push an entry.</Empty>
        ) : (
          history.toArray().map((e, i) => (
            <div key={i} className="lg-log-entry">
              <span className="lg-id">{e.docId}</span>
              <span className="lg-log-time">{e.when}</span>
              <div className="lg-log-diff">
                <span className="lg-log-old">{e.prevTags.join(", ") || "—"}</span>
                <span>→</span>
                <span className="lg-log-new">{e.nextTags.join(", ") || "—"}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── (c) Background Indexer ────────────────────────── */
function BackgroundIndexer({ docs }) {
  const [queue] = useState(() => {
    const q = new IndexQueue();
    [...docs].sort((a, b) => a.uploadOrder - b.uploadOrder).forEach((d) => q.enqueue(d.id));
    return q;
  });
  const [pending, setPending] = useState(queue.toArray());
  const [indexed, setIndexed] = useState([]);

  const step = () => {
    if (pending.length === 0) return;
    const next = pending[0];
    setIndexed((arr) => [...arr, next]);
    setPending((arr) => arr.slice(1));
  };
  const runAll = () => {
    setIndexed((arr) => [...arr, ...pending]);
    setPending([]);
  };
  const reset = () => {
    setPending([...docs].sort((a, b) => a.uploadOrder - b.uploadOrder).map((d) => d.id));
    setIndexed([]);
  };

  return (
    <div>
      <div className="lg-toolbar">
        <button className="lg-btn" onClick={step} disabled={pending.length === 0}>
          <Play size={16} /> Index next (dequeue)
        </button>
        <button className="lg-btn lg-btn-ghost" onClick={runAll} disabled={pending.length === 0}>
          Process all
        </button>
        <button className="lg-btn lg-btn-ghost" onClick={reset}>Reset</button>
      </div>
      <div className="lg-two-col">
        <div className="lg-panel">
          <div className="lg-panel-head">Queue — waiting (front → back)</div>
          {pending.length === 0 ? (
            <Empty>Queue empty. Everything is indexed.</Empty>
          ) : (
            pending.map((id, i) => (
              <div key={id} className={"lg-queue-item" + (i === 0 ? " is-front" : "")}>
                <span className="lg-id">{id}</span> {DOC_MAP[id]?.title}
                {i === 0 && <span className="lg-front-flag">next</span>}
              </div>
            ))
          )}
        </div>
        <div className="lg-panel">
          <div className="lg-panel-head">Indexed — searchable</div>
          {indexed.length === 0 ? (
            <Empty>Nothing indexed yet.</Empty>
          ) : (
            indexed.map((id) => (
              <div key={id} className="lg-doc-line lg-done">
                <Check size={14} /> <span className="lg-id">{id}</span> {DOC_MAP[id]?.title}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── (d) File Integrity Checker ────────────────────── */
function IntegrityChecker({ docs, setDocs }) {
  const [docId, setDocId] = useState(docs[0].id);
  const doc = docs.find((d) => d.id === docId);
  const result = verifyIntegrity(doc);

  const tamper = () => {
    setDocs((ds) =>
      ds.map((d) => (d.id === docId ? { ...d, content: d.content + " [edited]" } : d))
    );
  };
  const restore = () => {
    const original = DOCUMENTS.find((d) => d.id === docId);
    setDocs((ds) => ds.map((d) => (d.id === docId ? { ...d, content: original.content } : d)));
  };

  return (
    <div>
      <label className="lg-label">Document</label>
      <select className="lg-select" value={docId} onChange={(e) => setDocId(e.target.value)}>
        {docs.map((d) => (
          <option key={d.id} value={d.id}>{d.id} — {d.title}</option>
        ))}
      </select>

      <div className={"lg-integrity " + (result.ok ? "ok" : "bad")}>
        <div className="lg-integrity-icon">
          {result.ok ? <ShieldCheck size={28} /> : <X size={28} />}
        </div>
        <div>
          <div className="lg-integrity-status">
            {result.ok ? "Integrity verified" : "Checksum mismatch — file altered"}
          </div>
          <div className="lg-checksums">
            <div>stored&nbsp;&nbsp;<code>{result.stored}</code></div>
            <div>actual&nbsp;<code>{result.recomputed}</code></div>
          </div>
        </div>
      </div>

      <div className="lg-toolbar">
        <button className="lg-btn lg-btn-ghost" onClick={tamper}>Simulate corruption</button>
        <button className="lg-btn lg-btn-ghost" onClick={restore}>Restore</button>
      </div>
      <p className="lg-note">
        The checksum is a hash of the file id + contents. Lookup and compare is O(1) — no scanning the corpus.
      </p>
    </div>
  );
}

/* ─────────────────────── (f) Citation Map Hub ──────────────────────────── */
function CitationMap({ docs }) {
  const adj = useMemo(() => buildCitationGraph(docs), [docs]);
  // simple circular layout SVG
  const ids = docs.map((d) => d.id);
  const n = ids.length;
  const R = 150;
  const cx = 200;
  const cy = 200;
  const pos = {};
  ids.forEach((id, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pos[id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const [hover, setHover] = useState(null);

  return (
    <div className="lg-two-col">
      <svg viewBox="0 0 400 400" className="lg-graph" role="img" aria-label="Citation graph">
        {[...adj.entries()].map(([from, tos]) =>
          tos.map((to) => {
            const a = pos[from], b = pos[to];
            if (!a || !b) return null;
            const dim = hover && hover !== from && hover !== to;
            return (
              <line
                key={from + to}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                className="lg-edge"
                style={{ opacity: dim ? 0.12 : 0.5 }}
                markerEnd="url(#arrow)"
              />
            );
          })
        )}
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="14" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" className="lg-arrow" />
          </marker>
        </defs>
        {ids.map((id) => (
          <g
            key={id}
            onMouseEnter={() => setHover(id)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "pointer" }}
          >
            <circle cx={pos[id].x} cy={pos[id].y} r="16" className={"lg-node" + (hover === id ? " is-hover" : "")} />
            <text x={pos[id].x} y={pos[id].y + 4} className="lg-node-label">{id}</text>
          </g>
        ))}
      </svg>
      <div className="lg-panel">
        <div className="lg-panel-head">Adjacency list</div>
        {[...adj.entries()].map(([from, tos]) => (
          <div key={from} className={"lg-adj" + (hover === from ? " is-hover" : "")}>
            <span className="lg-id">{from}</span>
            <span className="lg-adj-arrow">→</span>
            {tos.length ? tos.map((t) => <span key={t} className="lg-tag">{t}</span>) : <em className="lg-muted">no citations</em>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────── (g) Quick Reference Finder ────────────────────── */
function QuickReference({ docs }) {
  const adj = useMemo(() => buildCitationGraph(docs), [docs]);
  const [start, setStart] = useState(docs[3].id);
  const [goal, setGoal] = useState(docs[8].id);
  const path = useMemo(() => shortestCitationPath(adj, start, goal), [adj, start, goal]);

  return (
    <div>
      <div className="lg-path-controls">
        <div>
          <label className="lg-label">From</label>
          <select className="lg-select" value={start} onChange={(e) => setStart(e.target.value)}>
            {docs.map((d) => <option key={d.id} value={d.id}>{d.id} — {d.title}</option>)}
          </select>
        </div>
        <div>
          <label className="lg-label">To</label>
          <select className="lg-select" value={goal} onChange={(e) => setGoal(e.target.value)}>
            {docs.map((d) => <option key={d.id} value={d.id}>{d.id} — {d.title}</option>)}
          </select>
        </div>
      </div>

      {path ? (
        <div className="lg-path">
          <div className="lg-path-len">Shortest path · {path.length - 1} hop(s)</div>
          <div className="lg-path-flow">
            {path.map((id, i) => (
              <span key={id} className="lg-path-step">
                <span className="lg-path-node">
                  <span className="lg-id">{id}</span>
                  <span className="lg-path-title">{DOC_MAP[id]?.title}</span>
                </span>
                {i < path.length - 1 && <span className="lg-path-arrow">→</span>}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <Empty>No citation path connects these documents.</Empty>
      )}
      <p className="lg-note">BFS guarantees the fewest hops through the citation network.</p>
    </div>
  );
}

/* ─────────────────────── (h) Search Data Balancer ──────────────────────── */
function DataBalancer({ docs }) {
  const servers = useMemo(() => partitionAcrossServers(docs, SERVER_COUNT), [docs]);
  const counts = servers.map((s) => s.docs.length);
  const max = Math.max(...counts, 1);
  return (
    <div>
      <p className="lg-note" style={{ marginTop: 0 }}>
        Each document's shard is hashed onto one of {SERVER_COUNT} servers, spreading load so no single
        server becomes a bottleneck.
      </p>
      <div className="lg-servers">
        {servers.map((s) => (
          <div key={s.id} className="lg-server">
            <div className="lg-server-head">
              <Server size={16} /> {s.name}
              <span className="lg-server-count">{s.docs.length}</span>
            </div>
            <div className="lg-server-bar">
              <div className="lg-server-fill" style={{ width: `${(s.docs.length / max) * 100}%` }} />
            </div>
            <div className="lg-server-docs">
              {s.docs.map((id) => <span key={id} className="lg-id">{id}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────── shared ───────────────────────────────── */
function Empty({ children }) {
  return <div className="lg-empty">{children}</div>;
}

function Style() {
  return (
    <style>{`
:root{
  --ink:#1c1a17; --paper:#f3eee4; --paper-2:#eae2d3; --line:#d6ccb8;
  --oxblood:#7a1f1f; --oxblood-2:#9a3030; --gold:#9c7a26;
  --muted:#6b6358; --green:#3f6b3a;
  --serif:"Iowan Old Style",Georgia,"Times New Roman",serif;
  --mono:"SFMono-Regular",ui-monospace,"Cascadia Mono",Menlo,monospace;
}
*{box-sizing:border-box}
.lg-root{
  min-height:100vh;background:var(--paper);color:var(--ink);
  font-family:var(--serif);
  background-image:radial-gradient(circle at 1px 1px, rgba(0,0,0,.025) 1px, transparent 0);
  background-size:22px 22px;
}
.lg-header{
  display:flex;align-items:center;gap:18px;
  padding:26px 32px;border-bottom:3px double var(--ink);
  max-width:1080px;margin:0 auto;
}
.lg-mark{
  font-size:46px;line-height:1;color:var(--oxblood);font-family:var(--serif);
  border:2px solid var(--ink);width:62px;height:62px;display:flex;
  align-items:center;justify-content:center;border-radius:2px;flex:none;
}
.lg-header h1{margin:0;font-size:34px;letter-spacing:.5px;font-weight:600}
.lg-sub{margin:2px 0 0;color:var(--muted);font-size:14.5px;font-style:italic}
.lg-corpus{
  margin-left:auto;font-family:var(--mono);font-size:11px;text-transform:uppercase;
  letter-spacing:1px;color:var(--muted);border:1px solid var(--line);
  padding:6px 10px;border-radius:2px;
}
.lg-nav{
  display:flex;flex-wrap:wrap;gap:2px;max-width:1080px;margin:0 auto;
  padding:14px 32px 0;
}
.lg-tab{
  display:flex;align-items:center;gap:7px;background:none;border:none;
  font-family:var(--mono);font-size:11.5px;letter-spacing:.4px;color:var(--muted);
  padding:9px 13px;cursor:pointer;border-bottom:2px solid transparent;
  text-transform:uppercase;transition:color .15s,border-color .15s;
}
.lg-tab:hover{color:var(--ink)}
.lg-tab.is-active{color:var(--oxblood);border-bottom-color:var(--oxblood);font-weight:600}
.lg-tab svg{flex:none}
.lg-main{
  max-width:1080px;margin:0 auto;padding:26px 32px 40px;
  border-top:1px solid var(--line);
}
.lg-feature-head{display:flex;align-items:baseline;gap:14px;margin-bottom:22px}
.lg-feature-head h2{margin:0;font-size:25px;font-weight:600}
.lg-ds-pill{
  font-family:var(--mono);font-size:11px;color:#fff;background:var(--ink);
  padding:4px 9px;border-radius:2px;letter-spacing:.3px;
}
.lg-two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px}
@media(max-width:760px){.lg-two-col{grid-template-columns:1fr}.lg-path-controls{grid-template-columns:1fr!important}}
.lg-h3{font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:0 0 10px}
.lg-panel{border:1px solid var(--line);background:rgba(255,255,255,.4);border-radius:3px;overflow:hidden}
.lg-panel-head{
  font-family:var(--mono);font-size:10.5px;text-transform:uppercase;letter-spacing:1px;
  color:var(--muted);padding:10px 14px;border-bottom:1px solid var(--line);
  background:rgba(0,0,0,.02);
}
/* search */
.lg-searchbar{
  display:flex;align-items:center;gap:10px;border:2px solid var(--ink);
  border-radius:3px;padding:12px 16px;margin-bottom:22px;background:#fff;
}
.lg-searchbar svg{color:var(--oxblood)}
.lg-searchbar input{border:none;outline:none;font-family:var(--serif);font-size:17px;width:100%;background:none;color:var(--ink)}
.lg-results{list-style:none;margin:0;padding:0;counter-reset:r}
.lg-result{display:flex;align-items:center;gap:16px;padding:14px 4px;border-bottom:1px solid var(--line)}
.lg-rank{font-family:var(--mono);font-size:13px;color:var(--oxblood);width:24px;text-align:right;font-weight:600}
.lg-result-body{flex:1}
.lg-result-title{font-size:17.5px;font-weight:600}
.lg-id{font-family:var(--mono);font-size:11px;color:var(--muted);background:rgba(0,0,0,.05);padding:1px 5px;border-radius:2px}
.lg-result-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;align-items:center}
.lg-folder-chip{font-family:var(--mono);font-size:10.5px;color:#fff;background:var(--oxblood);padding:2px 7px;border-radius:2px;text-transform:uppercase;letter-spacing:.4px}
.lg-tag{font-family:var(--mono);font-size:11px;color:var(--muted)}
.lg-score{text-align:center;font-family:var(--mono)}
.lg-score strong{display:block;font-size:21px;color:var(--ink)}
.lg-score span{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)}
/* chips */
.lg-chips{display:flex;flex-wrap:wrap;gap:7px}
.lg-chip{
  font-family:var(--mono);font-size:12px;border:1px solid var(--line);background:#fff;
  color:var(--ink);padding:6px 11px;border-radius:2px;cursor:pointer;transition:all .12s;
}
.lg-chip em{color:var(--muted);font-style:normal;margin-left:4px}
.lg-chip:hover{border-color:var(--ink)}
.lg-chip.is-active{background:var(--oxblood);color:#fff;border-color:var(--oxblood)}
.lg-chip.is-active em{color:rgba(255,255,255,.7)}
.lg-doc-line{padding:9px 14px;border-bottom:1px solid var(--line);font-size:15px}
.lg-doc-line:last-child{border-bottom:none}
.lg-done{color:var(--green);display:flex;align-items:center;gap:8px}
/* forms */
.lg-label{display:block;font-family:var(--mono);font-size:10.5px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:6px}
.lg-select{width:100%;font-family:var(--serif);font-size:15px;padding:9px 11px;border:1px solid var(--ink);border-radius:2px;background:#fff;color:var(--ink)}
.lg-btn{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;letter-spacing:.4px;background:var(--ink);color:#fff;border:none;padding:10px 15px;border-radius:2px;cursor:pointer;text-transform:uppercase}
.lg-btn:disabled{opacity:.35;cursor:not-allowed}
.lg-btn-ghost{background:#fff;color:var(--ink);border:1px solid var(--ink)}
.lg-toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}
/* history log */
.lg-log-entry{padding:11px 14px;border-bottom:1px solid var(--line)}
.lg-log-time{font-family:var(--mono);font-size:10px;color:var(--muted);margin-left:8px}
.lg-log-diff{display:flex;align-items:center;gap:8px;margin-top:5px;font-size:13px;flex-wrap:wrap}
.lg-log-old{color:var(--oxblood);text-decoration:line-through;opacity:.7}
.lg-log-new{color:var(--green);font-weight:600}
/* queue */
.lg-queue-item{padding:9px 14px;border-bottom:1px solid var(--line);font-size:14.5px;display:flex;align-items:center;gap:8px}
.lg-queue-item.is-front{background:rgba(122,31,31,.07)}
.lg-front-flag{margin-left:auto;font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#fff;background:var(--oxblood);padding:2px 6px;border-radius:2px}
/* integrity */
.lg-integrity{display:flex;align-items:center;gap:16px;border:2px solid;border-radius:3px;padding:18px 20px;margin:20px 0}
.lg-integrity.ok{border-color:var(--green);background:rgba(63,107,58,.06)}
.lg-integrity.bad{border-color:var(--oxblood);background:rgba(122,31,31,.06)}
.lg-integrity.ok .lg-integrity-icon{color:var(--green)}
.lg-integrity.bad .lg-integrity-icon{color:var(--oxblood)}
.lg-integrity-status{font-size:18px;font-weight:600;margin-bottom:6px}
.lg-checksums{font-family:var(--mono);font-size:12px;color:var(--muted);display:flex;gap:20px;flex-wrap:wrap}
.lg-checksums code{color:var(--ink)}
.lg-note{font-size:13.5px;color:var(--muted);font-style:italic;margin-top:14px}
/* graph */
.lg-graph{width:100%;border:1px solid var(--line);border-radius:3px;background:rgba(255,255,255,.4)}
.lg-edge{stroke:var(--oxblood);stroke-width:1.4}
.lg-arrow{fill:var(--oxblood)}
.lg-node{fill:#fff;stroke:var(--ink);stroke-width:1.6;transition:fill .12s}
.lg-node.is-hover{fill:var(--oxblood)}
.lg-node-label{font-family:var(--mono);font-size:9px;text-anchor:middle;fill:var(--ink);pointer-events:none}
.lg-node.is-hover+.lg-node-label{fill:#fff}
.lg-adj{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:12px}
.lg-adj.is-hover{background:rgba(122,31,31,.08)}
.lg-adj-arrow{color:var(--muted)}
.lg-muted{color:var(--muted)}
/* path */
.lg-path-controls{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:22px}
.lg-path{border:1px solid var(--line);border-radius:3px;padding:18px;background:rgba(255,255,255,.4)}
.lg-path-len{font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--oxblood);margin-bottom:14px}
.lg-path-flow{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.lg-path-step{display:flex;align-items:center;gap:10px}
.lg-path-node{display:flex;flex-direction:column;gap:3px;border:1px solid var(--ink);border-radius:2px;padding:8px 11px;background:#fff;min-width:90px}
.lg-path-title{font-size:11.5px;color:var(--muted)}
.lg-path-arrow{color:var(--oxblood);font-size:18px}
/* servers */
.lg-servers{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.lg-server{border:1px solid var(--line);border-radius:3px;padding:14px;background:rgba(255,255,255,.4)}
.lg-server-head{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:13px;font-weight:600}
.lg-server-count{margin-left:auto;background:var(--ink);color:#fff;border-radius:2px;padding:1px 8px;font-size:11px}
.lg-server-bar{height:6px;background:rgba(0,0,0,.07);border-radius:3px;margin:12px 0;overflow:hidden}
.lg-server-fill{height:100%;background:var(--oxblood)}
.lg-server-docs{display:flex;flex-wrap:wrap;gap:5px}
/* empty */
.lg-empty{padding:32px 14px;text-align:center;color:var(--muted);font-style:italic;font-size:15px}
.lg-footer{
  max-width:1080px;margin:0 auto;padding:18px 32px 40px;
  font-family:var(--mono);font-size:10.5px;text-transform:uppercase;letter-spacing:1px;
  color:var(--muted);border-top:1px solid var(--line);
}
.lg-tab:focus-visible,.lg-chip:focus-visible,.lg-btn:focus-visible,.lg-select:focus-visible,.lg-searchbar input:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`}</style>
  );
}
