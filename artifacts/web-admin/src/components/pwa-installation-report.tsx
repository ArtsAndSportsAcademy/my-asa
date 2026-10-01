import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export function PwaInstallationReport() {
  const { data, error } = useQuery({ queryKey: ["pwa-installations"], queryFn: () => customFetch<{ people: { id: string; name: string; installed: boolean; lastSeenAt: string | null }[] }>("/api/pwa/installations"), refetchInterval: 60_000 });
  if (error) return <p role="alert" className="text-sm">Não foi possível verificar as instalações.</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Verificando instalações…</p>;
  const missing = data.people.filter(person => !person.installed);
  return <details className="border rounded-lg p-4 my-4"><summary className="cursor-pointer text-sm font-medium">App na tela de início · {missing.length} pessoa(s) sem abertura instalada registrada</summary><p className="text-xs text-muted-foreground my-2">O navegador informa a primeira abertura pelo ícone. Uma instalação nunca aberta aqui ainda aparece pendente.</p><ul className="text-sm space-y-1">{data.people.map(person => <li key={person.id}>{person.name} · {person.installed ? "Instalação identificada" : "Ainda não identificada"}{person.lastSeenAt && <span className="text-muted-foreground"> · Última abertura: {new Date(person.lastSeenAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>}</li>)}</ul></details>;
}
