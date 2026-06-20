import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface MuralData {
  upcoming_birthdays: { name: string; date: string; daysUntil: number }[];
  upcoming_milestones: { name: string; label: string; date: string; daysUntil: number }[];
  recent_recognitions: {
    id: string;
    type: string;
    title: string;
    message: string;
    publishedAt: string | null;
    memberName: string | null;
  }[];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">{title}</h2>
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

function typeEmoji(type: string) {
  if (type.includes("BIRTHDAY")) return "🎂";
  if (type.includes("TIME_OF_HOUSE")) return "⭐";
  if (type.includes("ACHIEVEMENT")) return "🏆";
  return "🎖️";
}

export default function MuralPage() {
  const [data, setData] = useState<MuralData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/asa/mural", { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d: MuralData) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout title="Mural da Equipe">
      <div className="max-w-4xl mx-auto space-y-8 px-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mural da Equipe</h1>
          <p className="text-sm text-muted-foreground mt-1">Aniversários, marcos e reconhecimentos da sua equipe.</p>
        </div>

        {loading ? (
          <div className="space-y-6">
            {[0, 1, 2].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : !data ? (
          <Card className="p-8 text-center text-muted-foreground">Não foi possível carregar o mural.</Card>
        ) : (
          <div className="space-y-8">
            {/* Birthdays */}
            <Section title="🎉 Aniversários (próximos 30 dias)">
              {data.upcoming_birthdays.length === 0 ? (
                <EmptyState message="Nenhum aniversário nos próximos 30 dias." />
              ) : (
                <div className="grid gap-2">
                  {data.upcoming_birthdays.map((b, i) => (
                    <Card key={i} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🎂</span>
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

            {/* Milestones */}
            <Section title="⭐ Marcos (próximos 30 dias)">
              {data.upcoming_milestones.length === 0 ? (
                <EmptyState message="Nenhum marco de tempo de casa nos próximos 30 dias." />
              ) : (
                <div className="grid gap-2">
                  {data.upcoming_milestones.map((m, i) => (
                    <Card key={i} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">⭐</span>
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

            {/* Recognitions */}
            <Section title="🏆 Reconhecimentos Recentes">
              {data.recent_recognitions.length === 0 ? (
                <EmptyState message="Nenhum reconhecimento publicado ainda." />
              ) : (
                <div className="grid gap-3">
                  {data.recent_recognitions.map((r) => (
                    <Card key={r.id} className="p-4 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{typeEmoji(r.type)}</span>
                          <p className="text-sm font-semibold leading-snug">{r.title}</p>
                        </div>
                        {r.memberName && (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">{r.memberName}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed pl-7">{r.message}</p>
                      {r.publishedAt && (
                        <p className="text-[11px] text-muted-foreground pl-7">
                          {new Date(r.publishedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      )}
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
