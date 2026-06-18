import { useState } from "react";
import {
  useListLibraryDocuments,
  useListLibraryCategories,
  useGetLibraryDocument,
  getGetLibraryDocumentQueryKey,
} from "@workspace/api-client-react";
import type {
  LibraryDocumentItem,
  LibraryDocumentDetail,
  LibraryCategory,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Library,
  Search,
  RefreshCw,
  BookOpen,
  Tag,
  GitBranch,
  CheckCircle2,
  FileText,
  FolderOpen,
  X,
} from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  OPERATIONAL_PROCEDURE: "Procedimento Operacional",
  RULES_AND_POLICIES:    "Regras e Políticas",
  CHARACTER_REFERENCE:   "Referência de Personagens",
  COSTUME_REFERENCE:     "Referência de Figurinos",
  ONBOARDING_MATERIAL:   "Material de Onboarding",
  SAFETY_PROCEDURE:      "Procedimento de Segurança",
};

const TYPE_COLORS: Record<string, string> = {
  OPERATIONAL_PROCEDURE: "bg-blue-50 text-blue-700 border-blue-200",
  RULES_AND_POLICIES:    "bg-purple-50 text-purple-700 border-purple-200",
  CHARACTER_REFERENCE:   "bg-pink-50 text-pink-700 border-pink-200",
  COSTUME_REFERENCE:     "bg-orange-50 text-orange-700 border-orange-200",
  ONBOARDING_MATERIAL:   "bg-green-50 text-green-700 border-green-200",
  SAFETY_PROCEDURE:      "bg-red-50 text-red-700 border-red-200",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function SupervisorLibraryPage() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: docsData, isLoading, refetch } = useListLibraryDocuments({
    q: search || undefined,
    type: filterType !== "all" ? filterType : undefined,
    categoryId: filterCat !== "all" ? filterCat : undefined,
  });
  const { data: catsData } = useListLibraryCategories();
  const detailQueryKey = getGetLibraryDocumentQueryKey(selectedId ?? "");
  const { data: detailData } = useGetLibraryDocument(selectedId ?? "", { query: { queryKey: detailQueryKey, enabled: !!selectedId } });

  const documents = (docsData?.documents ?? []) as LibraryDocumentItem[];
  const categories = (catsData?.categories ?? []) as LibraryCategory[];
  const detail = detailData?.document as LibraryDocumentDetail | undefined;

  // Stats
  const total = documents.length;
  const byType = Object.keys(TYPE_LABELS).map((t) => ({
    type: t,
    count: documents.filter((d) => d.type === t).length,
  })).filter((r) => r.count > 0);

  return (
    <AdminLayout title="Biblioteca" subtitle="Consulte regras, procedimentos e referências da organização">
      <div className="flex gap-6 h-[calc(100vh-14rem)]">

        {/* ── Coluna Esquerda ── */}
        <div className="w-96 shrink-0 flex flex-col gap-3">
          {/* Stats rápidos */}
          <div className="grid grid-cols-2 gap-2">
            <Card className="py-0">
              <CardContent className="flex items-center gap-2 py-3 px-3">
                <Library className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Documentos</p>
                  <p className="text-lg font-bold leading-none">{total}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="py-0">
              <CardContent className="flex items-center gap-2 py-3 px-3">
                <FolderOpen className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Categorias</p>
                  <p className="text-lg font-bold leading-none">{categories.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar documentos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lista de docs */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <Library className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Nenhum documento encontrado
              </div>
            ) : (
              documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedId(doc.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-all ${
                    selectedId === doc.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm leading-snug line-clamp-2">{doc.title}</span>
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-medium ${TYPE_COLORS[doc.type] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {TYPE_LABELS[doc.type]?.split(" ")[0] ?? doc.type}
                    </span>
                  </div>
                  {doc.summary && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{doc.summary}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                    <span>v{doc.version}</span>
                    {doc.responsibleName && <><span>·</span><span>{doc.responsibleName}</span></>}
                    {doc.publishedAt && <><span>·</span><span>{fmtDate(doc.publishedAt)}</span></>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Coluna Direita — Leitura ── */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-w-0">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Selecione um documento</p>
                <p className="text-xs text-muted-foreground mt-1">Navegue pela lista e clique para visualizar</p>
              </div>
            </div>
          ) : !detail ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              {/* Cabeçalho */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-serif font-bold">{detail.title}</h2>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${TYPE_COLORS[detail.type] ?? ""}`}>
                      {TYPE_LABELS[detail.type] ?? detail.type}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <GitBranch className="h-3 w-3" />v{detail.version}
                    </span>
                    {detail.responsibleName && (
                      <span className="text-xs text-muted-foreground">{detail.responsibleName}</span>
                    )}
                    {detail.publishedAt && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Publicado em {fmtDate(detail.publishedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Sumário */}
              {detail.summary && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="py-3 px-4">
                    <p className="text-sm text-foreground/80 italic">{detail.summary}</p>
                  </CardContent>
                </Card>
              )}

              {/* Conteúdo */}
              <Card className="flex-1">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Documento Oficial
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {detail.body || <span className="text-muted-foreground italic">Sem conteúdo</span>}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
