import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastProps,
} from "@/components/ui/toast"

function AsaToastIcon({ variant }: { variant?: ToastProps["variant"] }) {
  const pose = variant === "destructive" ? "duvida" : "tarefa-concluida";
  const imagePath = `/asa/${pose}`;
  return (
    <img
      src={`${imagePath}.webp`}
      onError={(event) => {
        if (event.currentTarget.src.endsWith(".webp")) event.currentTarget.src = `${imagePath}.png`;
      }}
      alt=""
      className="w-10 h-10 flex-shrink-0 object-contain"
      draggable={false}
    />
  );
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <AsaToastIcon variant={variant} />
            <div className="grid gap-1 flex-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
