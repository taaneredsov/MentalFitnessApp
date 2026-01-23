import { base, tables } from "./airtable.js"
import { cache, cacheKey, TABLE_TTL } from "./cache.js"

type TableName = keyof typeof tables & string

interface SelectOptions {
  filterByFormula?: string
  maxRecords?: number
  returnFieldsByFieldId?: boolean
  sort?: Array<{ field: string; direction?: "asc" | "desc" }>
}

/**
 * Cached select query for Airtable
 * Returns cached data if available, otherwise fetches from Airtable and caches
 */
export async function cachedSelect<T>(
  tableName: TableName,
  options: SelectOptions = {},
  transform: (records: unknown[]) => T[]
): Promise<T[]> {
  const tableId = tables[tableName]
  const key = cacheKey(tableId, JSON.stringify(options))
  const ttl = TABLE_TTL[tableName as string] || 300

  // Try cache first
  const cached = await cache.get<T[]>(key)
  if (cached) {
    console.log(`Cache HIT: ${String(tableName)}`)
    return cached
  }

  console.log(`Cache MISS: ${String(tableName)}`)

  // Fetch from Airtable
  const query = base(tableId).select({
    returnFieldsByFieldId: true,
    ...options
  })

  const records = options.maxRecords === 1
    ? await query.firstPage()
    : await query.all()

  const data = transform(records)

  // Cache the result
  await cache.set(key, data, ttl)

  return data
}

/**
 * Invalidate cache for a specific table
 */
export async function invalidateTable(tableName: TableName): Promise<number> {
  const tableId = tables[tableName]
  return cache.invalidate(`airtable:${tableId}:*`)
}

/**
 * Wrapper for write operations that invalidates cache
 */
export async function withCacheInvalidation<T>(
  tableName: TableName,
  operation: () => Promise<T>
): Promise<T> {
  const result = await operation()
  await invalidateTable(tableName)
  return result
}
