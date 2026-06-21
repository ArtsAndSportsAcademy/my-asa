---
name: Forced password change (mustChangePassword)
description: How "must change provisional password on first access" is enforced across api-server, web-admin, and mobile.
---

# Forced password change

Admin cria usuário com senha provisória → `users.mustChangePassword=true`; a pessoa é obrigada a trocar antes de usar o app.

**Regra:** a obrigatoriedade DEVE ser enforced no servidor, não só no cliente.
**Why:** gate só no front (AuthContext lê `mustChangePassword` do localStorage/AsyncStorage) é trivialmente burlável — basta editar o storage ou chamar a API direto.
**How to apply:**
- api-server: middleware global `blockIfMustChangePassword` montado em `routes/index.ts` DEPOIS de `/auth` e `/health`, ANTES dos routers protegidos. Ele decodifica o Bearer token sozinho (requireAuth é por-rota, não global, então `req.user` ainda não existe nesse ponto), consulta `usersTable.mustChangePassword` e retorna 403 `MUST_CHANGE_PASSWORD`. Whitelist: apenas `/users/me/password` (mais `/auth/*` que já saiu antes).
- O flag é limpo em `POST /users/me/password` (mesmo handler que valida currentPassword via bcrypt).
- web-admin: `AuthGate` em App.tsx renderiza `ForcePasswordChange` quando `user.mustChangePassword`; bootstrap do AuthContext hidrata user a partir da resposta de `getMe` (não do blob do localStorage) para não confiar em estado adulterado.
- mobile: `_layout.tsx` redireciona para `/force-password-change`; o flag vem na resposta do login. Mesmo que o AsyncStorage fique stale, o guard do servidor bloqueia.
