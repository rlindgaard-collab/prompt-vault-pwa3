
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, Clipboard, Share2, RefreshCcw, Search, ExternalLink } from "lucide-react";

const defaultCsvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRTD5myRZpckG-JW5TmkGgvAoyH38rEWIi-g0ha7iQfyDHUDxBAdVp3N9_YUAeKLFE7ErQNuHnopAi0/pub?output=csv";

export default function App() {
  const [csvUrl, setCsvUrl] = useState(() => localStorage.getItem("pv_csv_url") || defaultCsvUrl);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pv_mapping") || "{}"); } catch { return {}; }
  });
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  useEffect(() => { localStorage.setItem("pv_csv_url", csvUrl); }, [csvUrl]);
  useEffect(() => { localStorage.setItem("pv_mapping", JSON.stringify(mapping)); }, [mapping]);

  const parsed = useMemo(() => {
    if (!rows.length) return [];
    const titleKey  = mapping.title  || guessHeader(headers, ["title","navn","name"]);
    const promptKey = mapping.prompt || guessHeader(headers, ["prompt","tekst","content","message"]);
    const tagsKey   = mapping.tags   || guessHeader(headers, ["tags","tag","labels"]);
    return rows.map(r => ({
      title: (r[titleKey] ?? "(uden titel)").toString().trim(),
      prompt: (r[promptKey] ?? "").toString(),
      tags: (r[tagsKey] ?? "").toString(),
    })).filter(p => p.prompt.trim().length > 0);
  }, [rows, mapping, headers]);

  const allTags = useMemo(() => {
    const s = new Set();
    parsed.forEach(p => p.tags.split(",").map(t => t.trim()).filter(Boolean).forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [parsed]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parsed.filter(p => {
      if (tag && !p.tags.split(",").map(t => t.trim().toLowerCase()).includes(tag.toLowerCase())) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q) || p.tags.toLowerCase().includes(q);
    });
  }, [parsed, query, tag]);

  async function fetchCsv() {
    if (!csvUrl) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(csvUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const { data, headers } = parseCSV(text);
      setRows(data);
      setHeaders(headers);
      setTimeout(() => listRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
    } catch(e) {
      setError("Kunne ikke hente CSV. Tjek linket og at arket er publiceret som CSV.");
    } finally {
      setLoading(false);
    }
  }

  function copyText(txt) { navigator.clipboard?.writeText(txt).catch(() => {}); }

  async function shareText(txt, title) {
    try {
      if (navigator.share) await navigator.share({ title: title || "Prompt", text: txt });
      else { copyText(txt); alert("Din enhed understøtter ikke deling – teksten er kopieret i stedet."); }
    } catch {}
  }

  function openChatGPT() { window.open("https://chat.openai.com/", "_blank"); }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="max-w-xl mx-auto p-4 sm:p-6">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Prompt Vault</h1>
          <button onClick={openChatGPT} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white">
            <ExternalLink className="w-4 h-4" /> Åbn ChatGPT
          </button>
        </header>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="w-4 h-4 text-slate-500" />
            <p className="text-sm text-slate-600">CSV-link fra Google Sheet</p>
          </div>
          <div className="flex gap-2">
            <input
              value={csvUrl}
              onChange={e => { setCsvUrl(e.target.value); localStorage.setItem("pv_csv_url", e.target.value); }}
              placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <button onClick={fetchCsv} disabled={!csvUrl || loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50">
              <RefreshCcw className={"w-4 h-4 " + (loading ? "animate-spin" : "")}/> Opdatér
            </button>
          </div>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          {headers.length > 0 && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <ColumnMapper label="Titel"   value={mapping.title}  onChange={v => setMapping(m => ({...m, title: v}))}  headers={headers} fallbacks={["title","navn","name"]} />
              <ColumnMapper label="Prompt*" value={mapping.prompt} onChange={v => setMapping(m => ({...m, prompt: v}))} headers={headers} fallbacks={["prompt","tekst","content","message"]} />
              <ColumnMapper label="Tags"    value={mapping.tags}   onChange={v => setMapping(m => ({...m, tags: v}))}   headers={headers} fallbacks={["tags","tag","labels"]} />
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Søg i titler, tekst og tags…" className="w-full pl-9 rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
          <select value={tag} onChange={e => setTag(e.target.value)} className="min-w-[120px] rounded-xl border border-slate-300 px-3 py-2 bg-white">
            <option value="">Alle tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div ref={listRef} className="overflow-y-auto max-h-[70vh] pr-1">
          <ul className="space-y-3">
            <AnimatePresence>
              {visible.map((p, idx) => (
                <motion.li key={idx} layout initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}>
                  <article className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
                    <header className="mb-1 flex items-center justify-between gap-2">
                      <h2 className="font-medium leading-tight">{p.title || "(uden titel)"}</h2>
                      <div className="flex items-center gap-1">
                        <button onClick={() => copyText(p.prompt)} className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50" title="Kopiér">
                          <Clipboard className="w-4 h-4" />
                        </button>
                        <button onClick={() => shareText(p.prompt, p.title)} className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50" title="Del">
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                    </header>
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{p.prompt}</p>
                    {p.tags && (
                      <p className="mt-2 text-xs text-slate-500">
                        {p.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => <span key={t} className="inline-block mr-1">#{t}</span>)}
                      </p>
                    )}
                  </article>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {visible.length === 0 && <div className="text-center text-slate-500 py-12">Ingen matches – prøv at rydde søgning/filtrering.</div>}
        </div>

        <footer className="mt-6 text-center text-xs text-slate-500">
          <p>Offline-klar PWA. Data hentes fra dit Google Sheet (CSV) og gemmes ikke på en server.</p>
        </footer>
      </div>
    </div>
  );
}

function ColumnMapper({ label, value, onChange, headers, fallbacks=[] }) {
  const guessed = guessHeader(headers, fallbacks);
  const current = value || guessed || "";
  return (
    <label className="text-sm text-slate-700">
      <span className="block mb-1">{label}</span>
      <select value={current} onChange={e => onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white">
        <option value="">(ikke valgt)</option>
        {headers.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
    </label>
  );
}

function guessHeader(headers, candidates) {
  const lower = headers.map(h => ({ raw: h, low: (h||"").toString().trim().toLowerCase() }));
  for (const c of candidates) { const f = lower.find(h => h.low === c); if (f) return f.raw; }
  for (const c of candidates) { const f = lower.find(h => h.low.startsWith(c)); if (f) return f.raw; }
  return "";
}

function parseCSV(text) {
  const rows = [];
  let i = 0, field = "", row = [], inQuotes = false;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow   = () => { rows.push(row); row = []; };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i+1] === '"') { field += '"'; i++; } else { inQuotes = false; } }
      else { field += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") pushField();
      else if (ch === "\n") { pushField(); pushRow(); }
      else if (ch === "\r") { /* ignore */ }
      else field += ch;
    }
    i++;
  }
  pushField(); pushRow();
  while (rows.length && rows[rows.length-1].every(c => c.trim() === "")) rows.pop();
  if (!rows.length) return { headers: [], data: [] };
  const headers = rows[0].map(h => h.trim());
  const data = rows.slice(1).map(r => Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ""])));
  return { headers, data };
}
