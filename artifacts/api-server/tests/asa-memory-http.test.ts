import assert from "node:assert/strict";
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import {
  aiMessages, asaAuditLogTable, asaMemoriesTable, conversations, db, operationsTable,
  organizationsTable, pool, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

async function run() {
  const tag = `asa_memory_${Date.now()}`;
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  const conversationIds: number[] = [];
  let server: http.Server | undefined;
  let auditFailureTriggerInstalled = false;
  let passed = 0;
  const check = (condition: unknown, label: string) => { assert.ok(condition, label); passed++; };
  try {
    const orgs = await db.insert(organizationsTable).values([{ name: tag }, { name: `${tag}_other` }]).returning();
    organizationIds.push(...orgs.map(org => org.id));
    const operations = await db.insert(operationsTable).values(orgs.map(org => ({ organizationId: org.id, name: tag, status: "ACTIVE" as const }))).returning();
    const makeUser = async (name: string, orgIndex: number, role: "ADMIN" | "MEMBER") => {
      const [user] = await db.insert(usersTable).values({ organizationId: orgs[orgIndex]!.id, name, username: `${tag}_${name}` }).returning();
      userIds.push(user!.id);
      const operation = operations.find(item => item.organizationId === orgs[orgIndex]!.id)!;
      await db.insert(userRolesTable).values({ userId: user!.id, operationId: operation.id, role, active: true });
      return { ...user!, role, operationId: operation.id };
    };
    const member = await makeUser("member", 0, "MEMBER");
    const colleague = await makeUser("colleague", 0, "MEMBER");
    const admin = await makeUser("admin", 0, "ADMIN");
    const foreignAdmin = await makeUser("foreign", 1, "ADMIN");
    server = http.createServer(app);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    const api = (user: typeof member) => (path: string, method = "GET", body?: unknown) => fetch(`${base}${path}`, {
      method, signal: AbortSignal.timeout(60_000),
      headers: { "content-type": "application/json", authorization: `Bearer ${signAccessToken({ sub: user.id, jti: `${tag}_${user.id}`, organizationId: user.organizationId!, role: user.role, operationIds: [user.operationId] })}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const mine = api(member), other = api(colleague), management = api(admin), foreign = api(foreignAdmin);
    type Memory = typeof asaMemoriesTable.$inferSelect;
    const list = async (client: typeof mine) => (await (await client("/asa/memories")).json()) as Memory[];
    const chat = async (client: typeof mine, content: string) => {
      const response = await client("/asa/conversations", "POST", { title: tag });
      const conversation = await response.json() as { id: number };
      assert.equal(response.status, 201);
      conversationIds.push(conversation.id);
      const answer = await client(`/asa/chat/${conversation.id}/messages`, "POST", { content });
      assert.equal(answer.status, 200);
      const body = await answer.text();
      assert.ok(!body.includes('"error":'), body);
      return body;
    };

    const anonymous = await fetch(`${base}/asa/memories`);
    check(anonymous.status === 401, "Anonymous requests cannot read memories");
    const created = await mine("/asa/memories", "POST", { type: "PERSONAL", key: "Preference", value: "Private original value", scope: colleague.id });
    const memory = await created.json() as Memory;
    check(created.status === 201 && memory.status === "PENDING" && memory.scope === member.id && memory.createdBy === member.id, "Personal proposal stays pending and owned by the authenticated account");
    check(!(await list(other)).some(item => item.id === memory.id), "Colleagues cannot read personal memories");
    check(!(await list(management)).some(item => item.id === memory.id), "Administrators cannot read another person's personal memories");
    check((await other(`/asa/memories/${memory.id}`, "PATCH", { status: "APPROVED" })).status === 403, "Colleagues cannot approve another person's memory");
    check((await management(`/asa/memories/${memory.id}`, "DELETE")).status === 403, "Administrators cannot delete another person's personal memory");
    check((await foreign(`/asa/memories/${memory.id}`, "PATCH", { status: "APPROVED" })).status === 404, "Cross-organization memory mutation is refused");
    const approved = await (await mine(`/asa/memories/${memory.id}`, "PATCH", { status: "APPROVED" })).json() as Memory;
    check(approved.status === "APPROVED" && approved.approvedBy === member.id && approved.approvedAt, "Owner explicitly approves with identity and timestamp");
    const disabledResponse = await mine(`/asa/memories/${memory.id}`, "PATCH", { status: "DISABLED" });
    const disabled = await disabledResponse.json() as Memory;
    check(disabledResponse.status === 200 && disabled.status === "DISABLED" && disabled.approvedBy === null && disabled.approvedAt === null, "Disabling clears active approval without deleting memory");
    check((await list(mine)).some(item => item.id === memory.id && item.status === "DISABLED"), "Owner can review disabled memories");
    check(!(await list(management)).some(item => item.id === memory.id), "Disabled personal memories stay private");
    const reapproved = await (await mine(`/asa/memories/${memory.id}`, "PATCH", { status: "APPROVED" })).json() as Memory;
    check(reapproved.status === "APPROVED" && reapproved.approvedBy === member.id, "Reactivation requires a new explicit approval");
    const edited = await (await mine(`/asa/memories/${memory.id}`, "PATCH", { value: "Private revised value" })).json() as Memory;
    check(edited.status === "PENDING" && edited.approvedBy === null && edited.approvedAt === null, "Editing content removes approval and makes it pending");
    const combined = await mine(`/asa/memories/${memory.id}`, "PATCH", { value: "Skipped review", status: "APPROVED" });
    check(combined.status === 400 && (await list(mine)).find(item => item.id === memory.id)?.value === "Private revised value", "Content cannot be edited and approved in a single request");
    check((await mine(`/asa/memories/${memory.id}`, "PATCH", {})).status === 400, "Empty update does not claim to edit a memory");
    check((await mine("/asa/memories", "POST", { type: "OPERATIONAL", key: "Shared", value: "Rule" })).status === 403, "Members cannot create shared rules");
    const sharedResponse = await management("/asa/memories", "POST", { type: "OPERATIONAL", key: "Shared", value: "Shared rule" });
    const shared = await sharedResponse.json() as Memory;
    check(sharedResponse.status === 201 && shared.status === "PENDING" && shared.scope === orgs[0]!.id, "Shared proposal is pending in the organization scope");
    check(!(await list(mine)).some(item => item.id === shared.id), "Members do not see pending shared rules");
    check((await mine(`/asa/memories/${shared.id}`, "PATCH", { status: "APPROVED" })).status === 403, "Members cannot approve shared rules");
    await management(`/asa/memories/${shared.id}`, "PATCH", { status: "APPROVED" });
    check((await list(mine)).some(item => item.id === shared.id && item.status === "APPROVED"), "Approved shared rules become visible in the organization");
    check(!(await list(foreign)).some(item => item.id === shared.id), "Shared rules never leak to another organization");
    await management(`/asa/memories/${shared.id}`, "PATCH", { status: "DISABLED" });
    check(!(await list(mine)).some(item => item.id === shared.id), "Disabling hides shared rules from members");
    check((await mine(`/asa/memories/${memory.id}`, "DELETE")).status === 204 && !(await list(mine)).some(item => item.id === memory.id), "Owner can delete the personal memory");
    const raceCreated = await mine("/asa/memories", "POST", { type: "PERSONAL", key: "Concurrent edit", value: "Before race" });
    const raceMemory = await raceCreated.json() as Memory;
    const raceResponses = await Promise.all([
      mine(`/asa/memories/${raceMemory.id}`, "PATCH", { value: "Concurrent value A" }),
      mine(`/asa/memories/${raceMemory.id}`, "PATCH", { value: "Concurrent value B" }),
    ]);
    const raceFinal = (await list(mine)).find(item => item.id === raceMemory.id);
    const raceAudits = await db.select().from(asaAuditLogTable).where(and(eq(asaAuditLogTable.userId, member.id), eq(asaAuditLogTable.organizationId, orgs[0]!.id)));
    const raceActionCount = raceAudits.flatMap(item => item.actionsExecuted ?? []).filter(item => item.action === "ASA_MEMORY_EDITED" && item.memoryId === raceMemory.id).length;
    check(raceResponses.every(response => response.status === 200) && ["Concurrent value A", "Concurrent value B"].includes(raceFinal?.value ?? ""), "Concurrent edits serialize and leave one complete committed value");
    check(raceActionCount === 2, "Every serialized concurrent edit is recorded exactly once in the audit");
    const auditFailureCreated = await mine("/asa/memories", "POST", { type: "PERSONAL", key: "Audit failure", value: "Before audit failure" });
    const auditFailureMemory = await auditFailureCreated.json() as Memory;
    await pool.query(`CREATE OR REPLACE FUNCTION asa_test_fail_memory_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.user_id::text = TG_ARGV[0] AND NEW.question = 'Edição de memória da ASA' THEN
          RAISE EXCEPTION 'Injected ASA audit failure';
        END IF;
        RETURN NEW;
      END;
    $$`);
    auditFailureTriggerInstalled = true;
    await pool.query(`CREATE TRIGGER asa_test_fail_memory_audit BEFORE INSERT ON asa_audit_log FOR EACH ROW EXECUTE FUNCTION asa_test_fail_memory_audit('${member.id}')`);
    const failedAuditEdit = await mine(`/asa/memories/${auditFailureMemory.id}`, "PATCH", { value: "Must roll back" });
    await pool.query("DROP TRIGGER asa_test_fail_memory_audit ON asa_audit_log");
    auditFailureTriggerInstalled = false;
    await pool.query("DROP FUNCTION asa_test_fail_memory_audit()");
    const auditFailureFinal = (await list(mine)).find(item => item.id === auditFailureMemory.id);
    const auditFailureRows = await db.select().from(asaAuditLogTable).where(and(eq(asaAuditLogTable.userId, member.id), eq(asaAuditLogTable.organizationId, orgs[0]!.id)));
    const auditFailureEditCount = auditFailureRows.flatMap(item => item.actionsExecuted ?? []).filter(item => item.action === "ASA_MEMORY_EDITED" && item.memoryId === auditFailureMemory.id).length;
    check(failedAuditEdit.status === 500 && auditFailureFinal?.value === "Before audit failure", "Audit failure rolls back the associated memory edit");
    check(auditFailureEditCount === 0, "Failed memory edit leaves no success event in the audit");
    const audits = await db.select().from(asaAuditLogTable).where(and(eq(asaAuditLogTable.userId, member.id), eq(asaAuditLogTable.organizationId, orgs[0]!.id)));
    const actions = audits.flatMap(item => item.actionsExecuted ?? []).filter(item => item.memoryId === memory.id);
    check(actions.length === 6 && actions.some(item => item.action === "ASA_MEMORY_DISABLED") && actions.some(item => item.action === "ASA_MEMORY_DELETED"), "Successful lifecycle changes are audited, refused changes are not recorded as success");
    check(!JSON.stringify(audits).includes("Private original value") && !JSON.stringify(audits).includes("Private revised value"), "Memory-management audit does not copy personal content");

    await chat(mine, 'ensine que "resumo particular" significa "minhas tarefas"');
    let shortcut = (await list(mine)).find(item => item.key === "ASA_COMMAND_ALIAS:resumo particular")!;
    check(shortcut.status === "PENDING", "Chat learning is not active before approval");
    await chat(mine, "sim");
    check((await list(mine)).find(item => item.id === shortcut.id)?.status === "PENDING", "Generic agreement does not approve a shortcut");
    await chat(mine, 'aprovo o atalho "resumo particular"');
    check((await list(mine)).find(item => item.id === shortcut.id)?.status === "APPROVED", "Exact shortcut approval activates the proposed rule");
    check(!(await list(other)).some(item => item.id === shortcut.id), "Learned shortcut belongs only to its author");
    await chat(mine, 'ensine que "resumo particular" significa "minhas folgas"');
    shortcut = (await list(mine)).find(item => item.id === shortcut.id)!;
    check(shortcut.status === "PENDING" && shortcut.value === "minhas folgas" && shortcut.approvedBy === null, "Re-teaching an approved shortcut deactivates the old meaning and proposes the new one");
    await chat(mine, 'ensine que "resumo particular" significa "minhas responsabilidades"');
    check((await list(mine)).find(item => item.id === shortcut.id)?.value === "minhas responsabilidades", "A pending proposal can also be corrected");
    await chat(mine, 'aprovo o atalho "resumo particular"');
    const answer = await chat(mine, "resumo particular");
    check(answer.includes("responsabilidade"), "Approved shortcut resolves to its updated registered query");
    await mine(`/asa/memories/${shortcut.id}`, "PATCH", { status: "DISABLED" });
    await chat(mine, 'ensine que "resumo particular" significa "minhas tarefas"');
    shortcut = (await list(mine)).find(item => item.id === shortcut.id)!;
    check(shortcut.status === "PENDING" && shortcut.value === "minhas tarefas", "Re-teaching a disabled shortcut still requires approval");
    console.log(`ASA memory HTTP: ${passed} checks passed`);
  } finally {
    if (auditFailureTriggerInstalled) {
      try {
        await pool.query("DROP TRIGGER IF EXISTS asa_test_fail_memory_audit ON asa_audit_log");
        await pool.query("DROP FUNCTION IF EXISTS asa_test_fail_memory_audit()");
      } catch {}
    }
    if (server) { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve())); }
    if (conversationIds.length) {
      await db.delete(aiMessages).where(inArray(aiMessages.conversationId, conversationIds));
      await db.delete(conversations).where(inArray(conversations.id, conversationIds));
    }
    if (organizationIds.length) {
      await db.delete(asaMemoriesTable).where(inArray(asaMemoriesTable.organizationId, organizationIds));
      await db.delete(asaAuditLogTable).where(inArray(asaAuditLogTable.organizationId, organizationIds));
    }
    if (userIds.length) {
      await db.delete(userRolesTable).where(inArray(userRolesTable.userId, userIds));
      await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    }
    if (organizationIds.length) {
      await db.delete(operationsTable).where(inArray(operationsTable.organizationId, organizationIds));
      await db.delete(organizationsTable).where(inArray(organizationsTable.id, organizationIds));
    }
    await pool.end();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
