import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function FormationActionsPage() {
  const [count, setCount] = useState(7), [busy, setBusy] = useState<string | null>(null);
  const query = useQueryClient(), { toast } = useToast();
  const { data, error } = useQuery({ queryKey: ["formation-library", count], queryFn: () => customFetch<{ formations: { id: string; name: string; peopleCount: number; timesUsed: number; approximate?: boolean }[] }>(`/api/formations?peopleCount=${count}`) });
  async function deactivate(id: string) {
    setBusy(id);
    try { await customFetch(`/api/formations/${id}/deactivate`, { method: "POST" }); await query.invalidateQueries({ queryKey: ["formation-library"] }); }
    catch (e) { toast({ title: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(null); }
  }
  return <AdminLayout title="Formações" subtitle="Consulta da biblioteca existente e desativação com 10 segundos para desfazer"><label className="flex gap-3 items-center">Quantidade de pessoas<input type="number" min={1} max={40} value={count} onChange={event => setCount(Math.max(1, Number(event.target.value)))} className="border rounded p-2 w-20" /></label>{error ? <p role="alert">Não foi possível consultar.</p> : <ul className="mt-5 space-y-3">{data?.formations.map(formation => <li key={formation.id} className="border rounded-lg p-4 flex justify-between gap-4"><span>{formation.name} · {formation.peopleCount} pessoas · {formation.timesUsed} usos{formation.approximate && " · Aproximada"}</span><Button size="sm" variant="outline" disabled={busy === formation.id} onClick={() => deactivate(formation.id)}>Desativar</Button></li>)}</ul>}</AdminLayout>;
}
