import { useEffect, useRef, useState } from "react";
import { setSensitiveActionHandler } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function ReasonConfirmation() {
  const [action, setAction] = useState<string | null>(null), [reason, setReason] = useState("");
  const resolve = useRef<((reason: string | null) => void) | null>(null);
  useEffect(() => {
    setSensitiveActionHandler(label => new Promise(done => { resolve.current?.(null); resolve.current = done; setReason(""); setAction(label); }));
    return () => { setSensitiveActionHandler(null); resolve.current?.(null); };
  }, []);
  function finish(value: string | null) { resolve.current?.(value); resolve.current = null; setAction(null); }
  return <Dialog open={Boolean(action)} onOpenChange={open => { if (!open) finish(null); }}><DialogContent><DialogHeader><DialogTitle>{action}</DialogTitle><DialogDescription>Escrever o motivo e confirmar aqui conclui a ação. Não haverá faixa de desfazer.</DialogDescription></DialogHeader><Label htmlFor="confirmation-reason">Motivo obrigatório</Label><Textarea id="confirmation-reason" autoFocus value={reason} onChange={event => setReason(event.target.value)} /><DialogFooter><Button variant="outline" onClick={() => finish(null)}>Voltar</Button><Button disabled={!reason.trim()} onClick={() => finish(reason.trim())}>Confirmar com este motivo</Button></DialogFooter></DialogContent></Dialog>;
}
