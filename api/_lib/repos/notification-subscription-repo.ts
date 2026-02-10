import { dbQuery } from "../db/client.js"

export interface PushSubscriptionRow {
  id: number
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  status: "active" | "revoked" | "expired"
  userAgent: string | null
  createdAt: string
  updatedAt: string
}

function mapRow(row: Record<string, unknown>): PushSubscriptionRow {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    endpoint: String(row.endpoint),
    p256dh: String(row.p256dh),
    auth: String(row.auth),
    status: String(row.status) as PushSubscriptionRow["status"],
    userAgent: row.user_agent ? String(row.user_agent) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }
}

export async function upsertPushSubscription(input: {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}): Promise<PushSubscriptionRow> {
  const result = await dbQuery<Record<string, unknown>>(
    `INSERT INTO push_subscriptions_pg (
      user_id,
      endpoint,
      p256dh,
      auth,
      status,
      user_agent,
      updated_at
    ) VALUES ($1, $2, $3, $4, 'active', $5, NOW())
    ON CONFLICT (endpoint)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      status = 'active',
      user_agent = EXCLUDED.user_agent,
      updated_at = NOW(),
      last_error = NULL
    RETURNING *`,
    [input.userId, input.endpoint, input.p256dh, input.auth, input.userAgent || null]
  )
  return mapRow(result.rows[0])
}

export async function revokePushSubscription(userId: string, endpoint: string): Promise<boolean> {
  const result = await dbQuery(
    `UPDATE push_subscriptions_pg
        SET status = 'revoked',
            updated_at = NOW()
      WHERE user_id = $1
        AND endpoint = $2
        AND status <> 'revoked'`,
    [userId, endpoint]
  )
  return result.rowCount > 0
}

export async function listActivePushSubscriptionsByUser(userId: string): Promise<PushSubscriptionRow[]> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT *
       FROM push_subscriptions_pg
      WHERE user_id = $1
        AND status = 'active'
      ORDER BY id ASC`,
    [userId]
  )
  return result.rows.map(mapRow)
}

export async function markPushSubscriptionExpired(subscriptionId: number, errorMessage?: string): Promise<void> {
  await dbQuery(
    `UPDATE push_subscriptions_pg
        SET status = 'expired',
            updated_at = NOW(),
            last_error = $2
      WHERE id = $1`,
    [subscriptionId, errorMessage || null]
  )
}

export async function markPushSubscriptionSuccess(subscriptionId: number): Promise<void> {
  await dbQuery(
    `UPDATE push_subscriptions_pg
        SET last_success_at = NOW(),
            last_error = NULL,
            updated_at = NOW()
      WHERE id = $1`,
    [subscriptionId]
  )
}

export async function markPushSubscriptionError(subscriptionId: number, errorMessage: string): Promise<void> {
  await dbQuery(
    `UPDATE push_subscriptions_pg
        SET last_error = $2,
            updated_at = NOW()
      WHERE id = $1`,
    [subscriptionId, errorMessage]
  )
}
