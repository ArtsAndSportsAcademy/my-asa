import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login: authenticate } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    setError(null);
    loginMutation.mutate(
      { data },
      {
        onSuccess: (result) => {
          authenticate(result.accessToken, result.refreshToken, result.user, result.roles);
          setLocation("/admin/home");
        },
        onError: () => {
          setError("Email ou senha inválidos");
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Left side - Brand */}
      <div className="hidden lg:flex w-1/2 bg-myasa-gradient items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1507676184212-d0330a151522?auto=format&fit=crop&q=80')] mix-blend-overlay opacity-10 bg-cover bg-center" />
        <div className="relative z-10 text-primary-foreground max-w-sm flex flex-col items-center text-center">
          <img
            src="/asinha.svg"
            alt="Asinha MyASA"
            className="w-36 h-40 mb-8"
            style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.4))" }}
          />
          <h1 className="text-5xl font-serif font-bold tracking-tight mb-4">MyASA</h1>
          <p className="text-xl text-primary-foreground/90 font-medium font-sans">
            Tudo da ASA em um só lugar
          </p>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex flex-col items-center gap-3 mb-8">
            <img
              src="/asinha.svg"
              alt="Asinha MyASA"
              className="w-16 h-18"
            />
            <h1 className="text-2xl font-bold text-foreground">MyASA</h1>
            <p className="text-sm text-muted-foreground">Tudo da ASA em um só lugar</p>
          </div>

          <Card className="border-none shadow-xl bg-card">
            <CardHeader className="space-y-3 pb-6">
              <CardTitle className="text-3xl font-serif">Bem-vindo ao MyASA</CardTitle>
              <CardDescription className="text-base">
                Entre com suas credenciais para continuar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  {error && (
                    <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email corporativo</FormLabel>
                        <FormControl>
                          <Input placeholder="usuario@myasa.demo" {...field} className="h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} className="h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full h-11 text-base font-medium" 
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? "Autenticando..." : "Entrar"}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter>
              <div className="w-full p-4 rounded-lg bg-muted text-muted-foreground text-sm border border-border/50">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Contas de demonstração:</p>
                    <ul className="space-y-1 font-mono text-xs">
                      <li>admin@myasa.demo / myasa123</li>
                      <li>supervisor@myasa.demo / myasa123</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
