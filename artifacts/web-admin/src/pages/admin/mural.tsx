import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useListUsers } from "@workspace/api-client-react";
import { MemberCombobox } from "@/components/member-combobox";
import { Plus } from "lucide-react";
import { AsaAvatar } from "@/components/AsaAvatar";

interface MuralData {
  upcoming_birthdays: { name: string; date: string; daysUntil: number }[];
  upcoming_milestones: { name: string; label: string; date: string; daysUntil: number }[];
  recent_recognitions: {
    id: string; type: string; title: string; message: string;
    publishedAt: string | null; memberName: string | null;
  }[];
  recent_notices: {
    id: string; title: string | null; content: string; urgency: string;
    publishedAt: string | null; authorName: string | null;
  }[];
  overdue_members?: { name: string; count: number }[];
}

const RECOGNITION_TYPES = [
  { value: "HIGHLIGHT",      label: "⭐ Destaque",          desc: "Reconhecimento geral de bom desempenho" },
  { value: "ACHIEVEMENT",    label: "🏆 Conquista",          desc: "Meta ou resultado alcançado" },
  { value: "THANK_YOU",      label: "🙏 Agradecimento",      desc: "Gratidão por uma contribuição" },
  { value: "TEAM_STAR",      label: "🌟 Estrela da Equipe",  desc: "Referência positiva para o time" },
  { value: "BIRTHDAY",       label: "🎂 Aniversário",        desc: "Mensagem de aniversário" },
  { value: "TIME_OF_HOUSE",  label: "📅 Tempo de Casa",      desc: "Marco de permanência na equipe" },
];

// ─── Helper components ────────────────────────────────────────────────────────

function Section({ title, action, children }: {
  title: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="p-4 text-center text-sm text-muted-foreground border-dashed">{message}</Card>
  );
}

function DaysUntilBadge({ days }: { days: number }) {
  if (days === 0) return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Hoje!</Badge>;
  if (days === 1) return <Badge variant="outline" className="text-[10px]">Amanhã</Badge>;
  return <Badge variant="outline" className="text-[10px]">Em {days} dias</Badge>;
}

function urgencyConfig(urgency: string) {
  if (urgency === "CRITICAL")  return { label: "Crítico",    cls: "bg-red-100 text-red-700 border-red-200",    bar: "bg-red-500" };
  if (urgency === "IMPORTANT") return { label: "Importante", cls: "bg-amber-100 text-amber-700 border-amber-200", bar: "bg-amber-500" };
  return                              { label: "Info",        cls: "bg-blue-50 text-blue-700 border-blue-200",  bar: "bg-blue-400" };
}

function recogEmoji(type: string) {
  const found = RECOGNITION_TYPES.find(t => t.value === type);
  return found ? found.label.split(" ")[0] : "🎖️";
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── New Recognition Dialog ────────────────────────────────────────────────────

function NewRecognitionDialog({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const { data: usersData } = useListUsers({ status: "ACTIVE" });
  const users = (usersData?.users ?? []).map((u: any) => ({ id: u.id, name: u.name }));

  const [form, setForm] = useState({ userId: "", type: "", title: "", message: "" });
  const [saving, setSaving] = useState(false);

  const valid = form.userId && form.type && form.title.trim() && form.message.trim();

  async function submit() {
    if (!valid) return;
    setSaving(true);
    try {
      const r = await fetch("/api/asa/recognitions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(String(r.status));
      toast({ title: "Reconhecimento publicado no mural! 🎉" });
      setForm({ userId: "", type: "", title: "", message: "" });
      onCreated();
      onClose();
    } catch {
      toast({ title: "Não foi possível publicar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Reconhecimento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Membro *</Label>
            <MemberCombobox
              value={form.userId}
              onChange={(v) => setForm((f) => ({ ...f, userId: v }))}
              users={users}
              placeholder="Selecionar membro"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
              <SelectContent>
                {RECOGNITION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="font-medium">{t.label}</span>
                    <span className="text-muted-foreground ml-1 text-xs">— {t.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input
              placeholder="ex: Excelente atuação no espetáculo de sexta"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem *</Label>
            <Textarea
              placeholder="Descreva o motivo do reconhecimento..."
              rows={3}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={!valid || saving}>
            {saving ? "Publicando..." : "Publicar no Mural"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getToken(): string {
  return localStorage.getItem("myasa_access_token") ?? "";
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function MuralPage() {
  const [data, setData] = useState<MuralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  function loadMural() {
    setLoading(true);
    fetch("/api/asa/mural", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d: MuralData) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadMural(); }, []);

  return (
    <AdminLayout title="Mural da Equipe">
      <NewRecognitionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={loadMural}
      />

      <div className="max-w-4xl mx-auto space-y-8 px-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mural da Equipe</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Avisos, reconhecimentos, aniversários e marcos da equipe — tudo em um lugar.
          </p>
        </div>

        {loading ? (
          <div className="space-y-6">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : !data ? (
          <Card className="p-8 text-center text-muted-foreground">
            Não foi possível carregar o mural.
          </Card>
        ) : (
          <div className="space-y-10">

            {/* ── Avisos ── */}
            <Section title="📢 Avisos Recentes">
              {(data.recent_notices ?? []).length === 0 ? (
                <EmptyState message="Nenhum aviso publicado ainda." />
              ) : (
                <div className="grid gap-3">
                  {(data.recent_notices ?? []).map((n) => {
                    const cfg = urgencyConfig(n.urgency);
                    return (
                      <Card key={n.id} className="overflow-hidden">
                        <div className={`h-1 w-full ${cfg.bar}`} />
                        <div className="p-4 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold leading-snug">
                              {n.title || n.content.slice(0, 60)}
                            </p>
                            <Badge variant="outline" className={`shrink-0 text-[10px] ${cfg.cls}`}>
                              {cfg.label}
                            </Badge>
                          </div>
                          {n.title && (
                            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                              {n.content}
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {n.authorName && <span>{n.authorName} · </span>}
                            {formatDate(n.publishedAt)}
                          </p>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* ── Tarefas Atrasadas ── */}
            {(data.overdue_members ?? []).length > 0 && (
              <Section title="⚠️ Membros com Tarefas Atrasadas">
                <div className="grid gap-2">
                  {(data.overdue_members ?? []).map((m, i) => (
                    <Card key={i} className="p-3 flex items-center justify-between border-amber-200">
                      <div className="flex items-center gap-3">
                        <AsaAvatar size="small" pose="aviso_importante" />
                        <div>
                          <p className="text-sm font-medium">{m.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.count} tarefa{m.count !== 1 ? "s" : ""} atrasada{m.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                        {m.count}
                      </Badge>
                    </Card>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Reconhecimentos ── */}
            <Section
              title="🏆 Reconhecimentos"
              action={
                <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Novo
                </Button>
              }
            >
              {data.recent_recognitions.length === 0 ? (
                <EmptyState message='Nenhum reconhecimento publicado ainda. Clique em "Novo" para começar.' />
              ) : (
                <div className="grid gap-3">
                  {data.recent_recognitions.map((r) => (
                    <Card key={r.id} className="p-4 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{recogEmoji(r.type)}</span>
                          <p className="text-sm font-semibold leading-snug">{r.title}</p>
                        </div>
                        {r.memberName && (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            {r.memberName}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed pl-7">
                        {r.message}
                      </p>
                      {r.publishedAt && (
                        <p className="text-[11px] text-muted-foreground pl-7">
                          {formatDate(r.publishedAt)}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Aniversários ── */}
            <Section title="🎉 Aniversários (próximos 30 dias)">
              {data.upcoming_birthdays.length === 0 ? (
                <EmptyState message="Nenhum aniversário nos próximos 30 dias." />
              ) : (
                <div className="grid gap-2">
                  {data.upcoming_birthdays.map((b, i) => (
                    <Card key={i} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {b.daysUntil === 0
                          ? <AsaAvatar size="small" pose="comemoracao" />
                          : <span className="text-xl">🎂</span>
                        }
                        <div>
                          <p className="text-sm font-medium">{b.name}</p>
                          <p className="text-xs text-muted-foreground">{b.date}</p>
                        </div>
                      </div>
                      <DaysUntilBadge days={b.daysUntil} />
                    </Card>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Marcos ── */}
            <Section title="⭐ Marcos de Tempo de Casa (próximos 30 dias)">
              {data.upcoming_milestones.length === 0 ? (
                <EmptyState message="Nenhum marco de tempo de casa nos próximos 30 dias." />
              ) : (
                <div className="grid gap-2">
                  {data.upcoming_milestones.map((m, i) => (
                    <Card key={i} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {m.daysUntil === 0
                          ? <AsaAvatar size="small" pose="comemoracao" />
                          : <span className="text-xl">⭐</span>
                        }
                        <div>
                          <p className="text-sm font-medium">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.label} · {m.date}</p>
                        </div>
                      </div>
                      <DaysUntilBadge days={m.daysUntil} />
                    </Card>
                  ))}
                </div>
              )}
            </Section>

          </div>
        )}
      </div>
    </AdminLayout>
  );
}
