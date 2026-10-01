import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function LocationActionsPage() {
  const [busy, setBusy] = useState<string | null>(null), query = useQueryClient(), { toast } = useToast();
  const { data, error } = useQuery({ queryKey: ["locations-with-closed"], queryFn: () => customFetch<{ locations: { id: string; name: string; closed: boolean }[] }>("/api/locations?includeClosed=true") });
  async function reopen(id: string) {
    setBusy(id);
    try { await customFetch(`/api/locations/${id}`, { method: "PATCH", body: JSON.stringify({ closed: false }) }); await query.invalidateQueries({ queryKey: ["locations-with-closed"] }); }
    catch (e) { if ((e as Error).name !== "AbortError") toast({ title: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(null); }
  }
  return <AdminLayout title="Locais" subtitle="Reabrir exige motivo: uma única confirmação"><ul className="space-y-3">{data?.locations.map(location => <li key={location.id} className="border rounded-lg p-4 flex justify-between gap-4"><span>{location.name} · {location.closed ? "Encerrado" : "Aberto"}</span>{location.closed && <Button size="sm" disabled={busy === location.id} onClick={() => reopen(location.id)}>Reabrir com motivo</Button>}</li>)}</ul>{error && <p role="alert">Não foi possível consultar os locais.</p>}</AdminLayout>;
}
