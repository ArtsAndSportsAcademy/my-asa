import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";
import { logger } from "./logger.js";

const log = logger.child({ domain: "bootstrap" });

const MARKER_KEY = "reset_admin_v1";
const ADMIN_NAME = "Administrador";
const ADMIN_EMAIL = "administrador.asa@myasa.app";
const ADMIN_USERNAME = "administrador.asa";
const ORG_NAME = "ASA";
const OPERATION_NAME = "Operação Principal";

/**
 * One-time, guarded production reset + admin seed.
 *
 * Runs ONLY when the env var RESET_PROD_DB === "1" AND it has never run before
 * (tracked by a marker row in the _bootstrap_log table). The marker guarantees
 * this destructive reset executes at most once per database, so app restarts
 * (autoscale) never re-wipe data. After it runs once, it is a no-op forever.
 */
export async function runProdBootstrap(): Promise<void> {
  if (process.env.RESET_PROD_DB !== "1") {
    return;
  }

  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!adminPassword) {
    log.error(
      "RESET_PROD_DB is set but BOOTSTRAP_ADMIN_PASSWORD is missing; skipping reset to avoid creating an admin without a password",
    );
    return;
  }

  const client = await pool.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS _bootstrap_log (
         key text PRIMARY KEY,
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
    );

    const already = await client.query(
      "SELECT 1 FROM _bootstrap_log WHERE key = $1",
      [MARKER_KEY],
    );
    if ((already.rowCount ?? 0) > 0) {
      log.info("bootstrap reset already applied; skipping");
      return;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await client.query("BEGIN");

    const tables = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename NOT IN ('_bootstrap_log', '__drizzle_migrations')`,
    );

    if (tables.rows.length > 0) {
      const quoted = tables.rows
        .map((r) => `"${r.tablename.replace(/"/g, '""')}"`)
        .join(", ");
      await client.query(
        `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
      );
    }

    const org = await client.query<{ id: string }>(
      "INSERT INTO organizations (name) VALUES ($1) RETURNING id",
      [ORG_NAME],
    );
    const orgId = org.rows[0].id;

    const op = await client.query<{ id: string }>(
      "INSERT INTO operations (organization_id, name) VALUES ($1, $2) RETURNING id",
      [orgId, OPERATION_NAME],
    );
    const operationId = op.rows[0].id;

    const user = await client.query<{ id: string }>(
      `INSERT INTO users (organization_id, name, email, username, password_hash, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE') RETURNING id`,
      [orgId, ADMIN_NAME, ADMIN_EMAIL, ADMIN_USERNAME, passwordHash],
    );
    const userId = user.rows[0].id;

    await client.query(
      `INSERT INTO user_roles (user_id, operation_id, role, active)
       VALUES ($1, $2, 'ADMIN', true)`,
      [userId, operationId],
    );

    await client.query(
      "INSERT INTO _bootstrap_log (key) VALUES ($1)",
      [MARKER_KEY],
    );

    await client.query("COMMIT");
    log.info(
      { orgId, operationId, userId },
      "production database reset and admin account created",
    );
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    log.error({ err }, "bootstrap reset failed");
    throw err;
  } finally {
    client.release();
  }
}
