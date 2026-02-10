import { Pool, type PoolClient, type QueryResult } from "pg"

let pool: Pool | null = null

function getDatabaseUrl(): string | null {
  return process.env.DATABASE_URL || null
}

export function isPostgresConfigured(): boolean {
  return !!getDatabaseUrl()
}

function getPool(): Pool {
  if (!pool) {
    const connectionString = getDatabaseUrl()
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required for Postgres operations")
    }

    const shouldUseSsl = process.env.PGSSLMODE === "require"

    pool = new Pool({
      connectionString,
      ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 10000),
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000)
    })

    pool.on("error", (err) => {
      console.error("[postgres] pool error:", err.message)
    })
  }

  return pool
}

export async function dbQuery<T = unknown>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params)
}

export async function withDbTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()

  try {
    await client.query("BEGIN")
    const result = await fn(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function closeDbPool(): Promise<void> {
  if (!pool) return
  await pool.end()
  pool = null
}

