import { useState } from "react";
import {
  useGetMyNotices,
  useMarkNoticeViewed,
  useConfirmNotice,
  getGetMyNoticesQueryKey,
} from "@workspace/api-client-react";
import type { MyNoticeItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bell,
  BellOff,
  RefreshCw,
  Info,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Send,
  Clock,
  User,
} from "lucide-react";

// ─── Config ────────────────────────────────────────────────────────────────────

const URGENCY_CFG = {
  INFORMATIVE: { label: "Informativo", border: "border-l-blue-400",  bg: "bg-blue-50/60",  badge: "bg-blue-100 text-blue-800",   Icon: Info },
  IMPORTANT:   { label: "Importante",  border: "border-l-amber-400", bg: "bg-amber-50/60", badge: "bg-amber-100 text-amber-800", Icon: AlertCircle },
  CRITICAL:    { label: "Crítico",     border: "border-l-red-500",   bg: "bg-red-50/60",   badge: "bg-red-100 text-red-800",     Icon: AlertTriangle },
} as const;

const RECIPIENT_STATUS_LABELS: Record<string, string> = {
  PENDING:   "Pendente",
  SENT:      "Recebido",
  VIEWED:    "Visualizado",
  CONFIRMED: "Confirmado",
  ESCALATED: "Escalado",
};

const TYPE_LABELS: Record<string, string> = {
  INFORMATIVE: "Informativo",
  IMPORTANT:   "Importante",
  PERSISTENT:  "Persistente",
  ESCALATED:   "Escalado",
};

function isUnreadStatus(status: string): boolean {
  return status === "SENT" || status === "PENDING";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MembroAvisosPage() {
  const qc = useQueryClient();
  const [selectedNotice, setSelectedNotice] = useState<MyNoticeItem | null>(null);

  const { data: notices, isLoading, isError, refetch, isFetching } = useGetMyNotices({});
  const viewMutation = useMarkNoticeViewed();
  const confirmMutation = useConfirmNotice();

  const items = (notices ?? []) as MyNoticeItem[];
  const unreadCount = items.filter((n) => isUnreadStatus(n.recipientStatus)).length;

  const handleOpen = (notice: MyNoticeItem) => {
    setSelectedNotice(notice);
    if (isUnreadStatus(notice.recipientStatus)) {
      viewMutation.mutate(
        { noticeId: notice.id },
        { onSettled: () => qc.invalidateQueries({ queryKey: getGetMyNoticesQueryKey() }) }
      );
    }
  };

  const handleConfirm = () => {
    if (!selectedNotice) return;
    confirmMutation.mutate(
      { noticeId: selectedNotice.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMyNoticesQueryKey() });
          setSelectedNotice((prev) =>
            prev ? { ...prev, recipientStatus: "CONFIRMED", confirmedAt: new Date().toISOString() } : prev
          );
        },
      }
    );
  };

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: getGetMyNoticesQueryKey() });
    refetch();
  };

  return (
    <AdminLayout title="Avisos" subtitle="O que mudou e você precisa saber">
      <div className="max-w-3xl space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-primary text-primary-foreground">
              <Bell className="h-3.5 w-3.5" />
              {unreadCount} não {unreadCount === 1 ? "lido" : "lidos"}
            </span>
          )}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Não foi possível carregar os avisos.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <BellOff className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Sem avisos no momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((n) => {
              const urg = URGENCY_CFG[n.urgency as keyof typeof URGENCY_CFG] ?? URGENCY_CFG.INFORMATIVE;
              const UrgIcon = urg.Icon;
              const isUnread = isUnreadStatus(n.recipientStatus);
              return (
                <div
                  key={n.id}
                  className={`border border-border rounded-xl border-l-4 ${urg.border} ${isUnread ? urg.bg : ""} p-4 cursor-pointer hover:shadow-sm transition-shadow`}
                  onClick={() => handleOpen(n)}
                >
                  <div className="flex items-start gap-3">
                    <UrgIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {n.title && <span className="text-sm font-semibold truncate">{n.title}</span>}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${urg.badge}`}>{urg.label}</span>
                        {isUnread && (
                          <span className="inline-block h-2 w-2 rounded-full bg-primary" aria-label="Não lido" />
                        )}
                        {n.requiresConfirmation && n.recipientStatus !== "CONFIRMED" && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">Confirmar</span>
                        )}
                        {n.type === "ESCALATED" && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Escalado</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{n.content}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        {n.publishedAt && (
                          <span className="flex items-center gap-1">
                            <Send className="h-3 w-3" />
                            {new Date(n.publishedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        <span className={`flex items-center gap-1 ${isUnread ? "text-primary font-medium" : ""}`}>
                          <Clock className="h-3 w-3" />
                          {RECIPIENT_STATUS_LABELS[n.recipientStatus] ?? n.recipientStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Detail Dialog ── */}
        <Dialog open={!!selectedNotice} onOpenChange={(o) => !o && setSelectedNotice(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {selectedNotice && (() => {
              const d = selectedNotice;
              const urg = URGENCY_CFG[d.urgency as keyof typeof URGENCY_CFG] ?? URGENCY_CFG.INFORMATIVE;
              const UrgIcon = urg.Icon;
              const alreadyConfirmed = d.recipientStatus === "CONFIRMED";
              return (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-2 flex-wrap">
                      <DialogTitle>{d.title ?? "Aviso"}</DialogTitle>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${urg.badge}`}>{urg.label}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        {TYPE_LABELS[d.type] ?? d.type}
                      </span>
                    </div>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    {/* Urgency banner */}
                    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${urg.bg}`}>
                      <UrgIcon className="h-4 w-4 text-muted-foreground" />
                      <span className={`text-sm font-medium px-1.5 py-0.5 rounded-full ${urg.badge}`}>{urg.label}</span>
                    </div>

                    {/* Content */}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{d.content}</p>

                    {/* ERA → AGORA */}
                    {(d.changeBefore || d.changeAfter) && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">O que mudou</span>
                        </div>
                        {d.changeBefore && (
                          <div className="rounded bg-red-50 border border-red-100 px-3 py-2">
                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">ERA</span>
                            <p className="text-sm text-red-800 mt-0.5">{d.changeBefore}</p>
                          </div>
                        )}
                        {d.changeAfter && (
                          <div className="rounded bg-green-50 border border-green-100 px-3 py-2">
                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">AGORA</span>
                            <p className="text-sm text-green-800 mt-0.5">{d.changeAfter}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Meta */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground border-t pt-3">
                      {d.authorName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          De: <strong className="text-foreground">{d.authorName}</strong>
                        </span>
                      )}
                      {d.publishedAt && (
                        <span>Publicado: <strong className="text-foreground">{new Date(d.publishedAt).toLocaleString("pt-BR")}</strong></span>
                      )}
                      {d.expiresAt && (
                        <span>Expira: <strong className="text-foreground">{new Date(d.expiresAt).toLocaleDateString("pt-BR")}</strong></span>
                      )}
                    </div>

                    {/* Confirm */}
                    {d.requiresConfirmation && !alreadyConfirmed && (
                      <div className="border-t pt-3">
                        <Button className="w-full" onClick={handleConfirm} disabled={confirmMutation.isPending}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {confirmMutation.isPending ? "Confirmando..." : "Confirmar leitura"}
                        </Button>
                      </div>
                    )}
                    {alreadyConfirmed && (
                      <div className="border-t pt-3 flex items-center justify-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-semibold">Leitura confirmada</span>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
