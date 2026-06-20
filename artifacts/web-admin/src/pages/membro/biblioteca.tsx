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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  X,
  BookOpen,
  GitBranch,
  CheckCircle2,
  FileText,
  User,
  RefreshCw,
} from "lucide-react";

// ─── Config ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  OPERATIONAL_PROCEDURE: "Procedimento Operacional",
  RULES_AND_POLICIES: "Regras e Políticas",
  CHARACTER_REFERENCE: "Ref. Personagens",
  COSTUME_REFERENCE: "Ref. Figurinos",
  ONBOARDING_MATERIAL: "Onboarding",
  SAFETY_PROCEDURE: "Segurança",
};

const TYPE_SHORT: Record<string, string> = {
  OPERATIONAL_PROCEDURE: "Proc. Op.",
  RULES_AND_POLICIES: "Regras",
  CHARACTER_REFERENCE: "Personagens",
  COSTUME_REFERENCE: "Figurinos",
  ONBOARDING_MATERIAL: "Onboarding",
  SAFETY_PROCEDURE: "Segurança",
};

const TYPE_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "OPERATIONAL_PROCEDURE", label: "Proc. Op." },
  { key: "RULES_AND_POLICIES", label: "Regras" },
  { key: "CHARACTER_REFERENCE", label: "Personagens" },
  { key: "COSTUME_REFERENCE", label: "Figurinos" },
  { key: "ONBOARDING_MATERIAL", label: "Onboarding" },
  { key: "SAFETY_PROCEDURE", label: "Segurança" },
];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MembroBibliotecaPage() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: categoriesData } = useListLibraryCategories();
  const categories = (categoriesData?.categories ?? []) as LibraryCategory[];

  const { data: docsData, isLoading, isError, refetch, isFetching } =
    useListLibraryDocuments({
      q: search || undefined,
      type: filterType !== "all" ? filterType : undefined,
      categoryId: filterCategory !== "all" ? filterCategory : undefined,
    });

  const detailQueryKey = getGetLibraryDocumentQueryKey(selectedId ?? "");
  const { data: detailData, isLoading: loadingDetail } = useGetLibraryDocument(
    selectedId ?? "",
    { query: { queryKey: detailQueryKey, enabled: !!selectedId } }
  );

  const documents = (docsData?.documents ?? []) as LibraryDocumentItem[];
  const detail = detailData?.document as LibraryDocumentDetail | undefined;

  return (
    <AdminLayout title="Biblioteca" subtitle="Documentos e referências oficiais">
      <div className="max-w-4xl space-y-4">
        {/* ── Search ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar documentos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {search.length > 0 && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* ── Filtros por tipo ── */}
        <div className="flex gap-1.5 flex-wrap">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                filterType === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Filtro por categoria ── */}
        {categories.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterCategory("all")}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                filterCategory === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              Todas as categorias
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilterCategory(c.id)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                  filterCategory === c.id
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Lista ── */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar a biblioteca.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : documents.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">Biblioteca ainda vazia</p>
            <p className="text-sm text-muted-foreground mt-1">
              Em breve o administrador vai adicionar materiais aqui.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => setSelectedId(doc.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <h3 className="flex-1 text-sm font-semibold leading-snug line-clamp-2">
                      {doc.title}
                    </h3>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {TYPE_SHORT[doc.type] ?? doc.type}
                    </Badge>
                  </div>
                  {doc.summary && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                      {doc.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2.5 text-[11px] text-muted-foreground flex-wrap">
                    <span>v{doc.version}</span>
                    {doc.responsibleName && <span>· {doc.responsibleName}</span>}
                    {doc.publishedAt && <span>· {fmtDate(doc.publishedAt)}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Detail Dialog ── */}
      <Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.title ?? "Carregando..."}</DialogTitle>
          </DialogHeader>

          {loadingDetail || !detail ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Meta */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {TYPE_LABELS[detail.type] ?? detail.type}
                </Badge>
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-primary font-medium">
                  <GitBranch className="h-3 w-3" />
                  v{detail.version}
                </span>
                {detail.publishedAt && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    {fmtDate(detail.publishedAt)}
                  </span>
                )}
              </div>

              {detail.responsibleName && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  Responsável: {detail.responsibleName}
                </p>
              )}

              {/* Sumário */}
              {detail.summary && (
                <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-3">
                  <p className="text-sm italic text-foreground">{detail.summary}</p>
                </div>
              )}

              {/* Conteúdo */}
              <div className="rounded-lg bg-muted p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  <FileText className="h-3.5 w-3.5" />
                  Conteúdo do Documento
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {detail.body || "Sem conteúdo disponível."}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
