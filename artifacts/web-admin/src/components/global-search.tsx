import { useEffect, useState } from "react";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";

type Result = { groups: { key: string; label: string; items: { id: string; label: string; href: string; subtitle?: string }[] }[]; asaAtTop: boolean };
export function GlobalSearch() {
  const [query, setQuery] = useState(""), [result, setResult] = useState<Result | null>(null), [open, setOpen] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    setResult(null); setError("");
    if (!query.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => customFetch<Result>(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal }).then(setResult).catch(e => { if (!controller.signal.aborted) setError("Não foi possível buscar. Tente novamente."); }), 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  const asa = <Link href={`/admin/asa?question=${encodeURIComponent(query)}`} className="block rounded px-3 py-3 text-sm text-primary hover:bg-muted" onClick={() => setOpen(false)}>Perguntar à ASA: {query}</Link>;
  return <div className="relative ml-auto w-[min(45vw,380px)]" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <Input aria-label="Busca global" placeholder="Pessoa, data, show ou documento…" value={query} maxLength={200} onFocus={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setOpen(true); }} onKeyDown={e => { if (e.key === "Escape") setOpen(false); }} />
    {open && query.trim() && <div className="absolute right-0 top-full mt-2 bg-card border rounded-xl shadow-xl w-[min(92vw,430px)] max-h-[75vh] overflow-auto p-2 z-40" aria-live="polite">
      {error ? <p role="alert" className="p-3 text-sm">{error}</p> : !result ? <p className="p-3 text-sm">Buscando…</p> : <>
        {result.asaAtTop && asa}
        {result.groups.map(group => group.items.length > 0 && <section key={group.key}><h2 className="px-3 pt-3 text-xs uppercase text-muted-foreground">{group.label}</h2>{group.items.map(item => <Link key={item.id} href={item.href} onClick={() => setOpen(false)} className="block px-3 py-2 rounded hover:bg-muted text-sm">{item.label}{item.subtitle && <span className="block text-xs text-muted-foreground">{item.subtitle}</span>}</Link>)}</section>)}
        {result.groups.every(group => !group.items.length) && <p className="p-3 text-sm text-muted-foreground">Nenhum resultado no seu acesso.</p>}
        {!result.asaAtTop && <div className="border-t mt-2">{asa}</div>}
      </>}
    </div>}
  </div>;
}
