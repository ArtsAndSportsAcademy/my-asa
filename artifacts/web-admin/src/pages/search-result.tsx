import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { useSearch } from "wouter";
export default function SearchResultPage() {
  const parameters = new URLSearchParams(useSearch()), personId = parameters.get("person"), date = parameters.get("date");
  const documentId = parameters.get("document"), showId = parameters.get("show"), noticeId = parameters.get("notice");
  const path = documentId ? `/api/library/documents/${documentId}` : showId ? `/api/show-books/${showId}` : noticeId ? `/api/notices/${noticeId}` : null;
  const detail = useQuery({ queryKey: ["search-detail", path], enabled: Boolean(path), queryFn: () => customFetch<Record<string, any>>(path!) });
  const { data, error } = useQuery({ queryKey: ["directory-person", personId], enabled: Boolean(personId), queryFn: () => customFetch<{ person: { id: string; name: string; preferredName: string | null } }>(`/api/directory/people/${personId}`) });
  const item = detail.data?.document ?? detail.data?.showBook ?? detail.data;
  return <AdminLayout title={date ? `Dia ${date.split("-").reverse().join("/")}` : personId ? "Pessoa no diretório" : "Resultado da busca"}>{date ? <><p>Abra a escala publicada deste dia no seu acesso.</p><a className="text-primary underline" href={`/print/day?date=${date}`}>Ver o dia e imprimir</a></> : path ? detail.error ? <p role="alert">Conteúdo indisponível no seu acesso.</p> : detail.isPending ? <p>Carregando…</p> : <article><h2 className="text-xl font-medium">{item?.title ?? "Conteúdo"}</h2><p className="text-xs text-muted-foreground">{item?.status}</p><p className="mt-4 whitespace-pre-wrap">{item?.body ?? item?.content ?? item?.description}</p>{item?.scenes?.map((scene: { id: string; name: string }) => <p key={scene.id}>{scene.name}</p>)}</article> : error ? <p role="alert">Pessoa indisponível no seu acesso.</p> : data ? <section><h2 className="text-lg font-medium">{data.person.name}</h2>{data.person.preferredName && <p>Nome de uso: {data.person.preferredName}</p>}<p className="text-muted-foreground mt-3">Diretório da equipe. Não expõe a ficha privada ou ocorrências.</p></section> : <p>Carregando…</p>}</AdminLayout>;
}
