import { useState } from "react";
import { useChangeMyPassword } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ForcePasswordChange() {
  const { markPasswordChanged, logout } = useAuth();
  const changeMutation = useChangeMyPassword();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword || !newPassword) {
      setError("Preencha todos os campos.");
      return;
    }
    if (newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A nova senha e a confirmação não coincidem.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("A nova senha deve ser diferente da senha provisória.");
      return;
    }

    changeMutation.mutate(
      { data: { currentPassword, newPassword } },
      {
        onSuccess: () => {
          markPasswordChanged();
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? "Não foi possível alterar a senha. Verifique a senha provisória.";
          setError(msg);
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img src="/asinha.svg" alt="Asinha MyASA" className="w-16 h-18" />
          <h1 className="text-2xl font-bold text-foreground">MyASA</h1>
        </div>

        <Card className="border-none shadow-xl bg-card">
          <CardHeader className="space-y-3 pb-6">
            <CardTitle className="text-2xl font-serif">Crie sua senha</CardTitle>
            <CardDescription className="text-base">
              Por segurança, você precisa trocar a senha provisória por uma senha sua antes de continuar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Senha provisória (atual)</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label>Nova senha</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label>Confirmar nova senha</Label>
                <Input
                  type="password"
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11"
                />
              </div>

              <Button type="submit" className="w-full h-11 text-base font-medium" disabled={changeMutation.isPending}>
                {changeMutation.isPending ? "Salvando..." : "Salvar nova senha"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={logout}
                disabled={changeMutation.isPending}
              >
                Sair
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
