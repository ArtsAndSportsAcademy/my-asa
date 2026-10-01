import { useEffect, useState } from "react";
import { customFetch, setActionUndoHandler, type ActionUndo } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function UndoNotices() {
  const [actions, setActions] = useState<ActionUndo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [, clock] = useState(0);
  const query = useQueryClient(), { toast } = useToast();
  useEffect(() => {
    setActionUndoHandler(undo => setActions(old => [...old.filter(item => item.id !== undo.id), undo]));
    const timer = setInterval(() => { setActions(old => old.filter(item => Date.parse(item.expiresAt) > Date.now())); clock(value => value + 1); }, 250);
    return () => { clearInterval(timer); setActionUndoHandler(null); };
  }, []);
  async function undo(action: ActionUndo) {
    setBusy(action.id);
    try {
      await customFetch(`/api/actions/${action.id}/undo`, { method: "POST" });
      setActions(old => old.filter(item => item.id !== action.id));
      await query.invalidateQueries();
      toast({ title: "Ação desfeita. O aviso pendente foi cancelado." });
    } catch (error) { toast({ title: (error as Error).message, variant: "destructive" }); }
    finally { setBusy(null); }
  }
  return <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 space-y-2 w-[min(92vw,520px)]" aria-live="polite">{actions.map(action => <div key={action.id} className="bg-foreground text-background rounded-lg shadow-lg px-4 py-3 flex items-center justify-between gap-4"><span>Ação realizada · {Math.max(0, Math.ceil((Date.parse(action.expiresAt) - Date.now()) / 1000))}s</span><Button variant="secondary" disabled={busy === action.id} onClick={() => undo(action)}>Desfazer</Button></div>)}</div>;
}
