import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { AsaAvatar } from "./AsaAvatar";
import { AsaSpeechBubble } from "./AsaSpeechBubble";

interface AsaConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  bubbleText?: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isPending?: boolean;
  confirmIcon?: React.ReactNode;
}

export function AsaConfirmDialog({
  open,
  onClose,
  title,
  bubbleText = "Tem certeza? Essa ação não pode ser desfeita. ⚠️",
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  isPending = false,
  confirmIcon,
}: AsaConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex items-start gap-3 py-1">
          <AsaAvatar size="medium" pose="aviso_importante" />
          <div className="flex-1 pt-2">
            <AsaSpeechBubble text={bubbleText} visible={open} duration={600000} />
          </div>
        </div>
        {description && (
          <div className="text-sm text-muted-foreground">{description}</div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {confirmIcon}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
