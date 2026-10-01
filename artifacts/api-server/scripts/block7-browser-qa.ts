/** Local-only disposable browser harness. Never imported by the production runtime. */
import express from "express";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db, pool, organizationsTable, operationsTable, usersTable, userRolesTable, pwaInstallationsTable, webPushSubscriptionsTable, historyEventsTable, scalesTable, scaleAllocationsTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { deliverWebPush } from "../src/services/web-push.js";
import { operationalDate } from "../src/lib/operational-date.js";

if (process.env.MYASA_TEST_RUNNER !== "1") throw new Error("Somente com .env.test e MYASA_TEST_RUNNER=1");
const tag = `block7_browser_${Date.now()}`;
const [org] = await db.insert(organizationsTable).values({ name: tag }).returning();
const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: tag }).returning();
const [user] = await db.insert(usersTable).values({ organizationId: org!.id, name: "Teste de navegador My ASA", username: tag }).returning();
await db.insert(userRolesTable).values({ userId: user!.id, operationId: op!.id, role: "ADMIN" });
const token = signAccessToken({ sub: user!.id, jti: randomUUID(), role: "ADMIN", organizationId: org!.id, operationIds: [op!.id] });
const printPeople = await db.insert(usersTable).values(Array.from({ length: 40 }, (_, i) => ({ organizationId: org!.id, name: `Pessoa de teste ${String(i + 1).padStart(2, "0")}` }))).returning();
const today = operationalDate();
const [printScale] = await db.insert(scalesTable).values({ operationId: op!.id, title: "Snowland", periodStart: today, periodEnd: today, status: "PUBLISHED", createdBy: user!.id }).returning();
await db.insert(scaleAllocationsTable).values(printPeople.flatMap(person => [{ scaleId: printScale!.id, userId: person.id, status: "ASSIGNED" as const, manualDate: today, manualLabel: "Musical", startTime: "10:00", endTime: "11:00" }, { scaleId: printScale!.id, userId: person.id, status: "ASSIGNED" as const, manualDate: today, manualLabel: "Patinação", startTime: "16:00", endTime: "17:00" }]));
const vapid = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = vapid.publicKey; process.env.VAPID_PRIVATE_KEY = vapid.privateKey; process.env.VAPID_SUBJECT = "mailto:test@example.com";
const publicDir = path.resolve(process.cwd(), "../web-admin/dist/public");
app.get("/sw.js", (_req, res) => res.sendFile(path.resolve(process.cwd(), "../web-admin/public/sw.js")));
app.get("/qa/app", (_req, res) => res.type("html").send(`<!doctype html><meta charset="utf-8"><script>localStorage.setItem('myasa_access_token',${JSON.stringify(token)});localStorage.setItem('myasa_user',${JSON.stringify(JSON.stringify(user))});localStorage.setItem('myasa_roles',${JSON.stringify(JSON.stringify([{ role: "ADMIN", operationId: op!.id, userId: user!.id }]))});localStorage.setItem('myasa_capabilities','["VIEW_HOME","USE_ASA"]');location.replace('/print/day?date=${today}');</script>`));
app.get("/qa/browser", (_req, res) => res.type("html").send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="manifest" href="/manifest.webmanifest"><title>My ASA · teste local de navegador</title><body style="font:17px system-ui;margin:3rem;max-width:50rem"><h1>My ASA · teste local, sem produção</h1><p id="capabilities"></p><p id="installed"></p><p>Instale pelo menu do navegador e abra pelo ícone antes de ativar. O teste usa somente uma pessoa fictícia.</p><button id="subscribe">Ativar notificações de teste</button> <button id="send">Enviar: escala mudou</button><p id="result" role="status"></p><script>
const token=${JSON.stringify(token)}, key=${JSON.stringify(vapid.publicKey)};
const installed=matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone);
document.querySelector('#capabilities').textContent='Service Worker: '+('serviceWorker' in navigator)+' · PushManager: '+('PushManager' in window)+' · Notification: '+('Notification' in window)+' · Contexto seguro: '+isSecureContext;
document.querySelector('#installed').textContent='Abertura instalada: '+installed;
const call=(url,body)=>fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='myasa-push-received') document.querySelector('#result').textContent='Push recebido pelo service worker e notificação exibida: '+e.data.category;});
document.querySelector('#subscribe').onclick=async()=>{try{if(!installed)throw new Error('Abra pelo ícone instalado primeiro.');if(!('PushManager' in window))throw new Error('Este navegador não expõe PushManager.');const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Permissão não concedida.');const registration=await navigator.serviceWorker.ready;const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0))});const id=crypto.randomUUID();await call('/api/pwa/installations',{installationId:id,displayMode:'standalone'});const response=await call('/api/web-push/subscriptions',{...subscription.toJSON(),installationId:id});if(!response.ok)throw new Error('Inscrição rejeitada: '+response.status);document.querySelector('#result').textContent='Navegador real inscrito.';}catch(e){document.querySelector('#result').textContent=e.message;}};
document.querySelector('#send').onclick=async()=>{const response=await call('/qa/send',{});document.querySelector('#result').textContent=await response.text();};
</script></body></html>`));
app.post("/qa/send", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${token}`) { res.sendStatus(401); return; }
  try { const result = await deliverWebPush({ userId: user!.id, type: "scale.changed", title: "Teste", message: "Teste", category: "schedule" }); console.log("Browser push transport:", result); res.json(result); }
  catch (error) { res.status(502).json({ error: (error as Error).name }); }
});
app.post("/qa/stop", (req, res) => {
  if (req.headers.authorization !== `Bearer ${token}`) { res.sendStatus(401); return; }
  res.json({ stopped: true });
  setTimeout(() => void stop(), 100);
});
app.use(express.static(publicDir));
app.get("/", (_req, res) => res.redirect("/qa/browser"));
app.get("/{*path}", (req, res) => req.path.startsWith("/api/") ? res.sendStatus(404) : res.sendFile(path.join(publicDir, "index.html")));
const server = app.listen(4188, "127.0.0.1", () => console.log("QA local em http://127.0.0.1:4188/qa/browser; pessoa fictícia; VAPID efêmero em memória."));
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.closeAllConnections(); server.close();
  await db.delete(webPushSubscriptionsTable).where(eq(webPushSubscriptionsTable.userId, user!.id));
  await db.delete(pwaInstallationsTable).where(eq(pwaInstallationsTable.userId, user!.id));
  await db.delete(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
  await db.delete(userRolesTable).where(eq(userRolesTable.userId, user!.id));
  await db.delete(scaleAllocationsTable).where(eq(scaleAllocationsTable.scaleId, printScale!.id));
  await db.delete(scalesTable).where(eq(scalesTable.id, printScale!.id));
  for (const person of printPeople) await db.delete(usersTable).where(eq(usersTable.id, person.id));
  await db.delete(usersTable).where(eq(usersTable.id, user!.id));
  await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
  await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  await pool.end(); process.exit(0);
}
process.on("SIGINT", () => void stop()); process.on("SIGTERM", () => void stop());
