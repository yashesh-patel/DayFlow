import { pool } from "./db.js";

/**
 * Records a sensitive action for later review (who did what, to what, when).
 * Never throws -- an audit-log failure must not block the underlying action.
 */
export const logAudit = async ({
  actorRole,
  actorId,
  action,
  targetTable = null,
  targetId = null,
  metadata = {},
}) => {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_role, actor_id, action, target_table, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorRole, actorId || null, action, targetTable, targetId, JSON.stringify(metadata)],
    );
  } catch (error) {
    console.error("logAudit failed:", error.message);
  }
};
