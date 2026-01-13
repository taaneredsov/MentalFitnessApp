import Redis from "ioredis"

// Singleton Redis client
let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.USE_LOCAL_REDIS === "true"
      ? "redis://localhost:6379"
      : process.env.REDIS_URL

    if (!url) {
      throw new Error("REDIS_URL environment variable is required")
    }

    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          return null // Stop retrying after 3 attempts
        }
        return Math.min(times * 100, 2000)
      }
    })

    redis.on("error", (err) => {
      console.error("Redis connection error:", err.message)
    })
  }
  return redis
}

// Public API
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await getRedis().get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error("Cache get error:", error)
      return null
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    try {
      await getRedis().setex(key, ttlSeconds, JSON.stringify(value))
    } catch (error) {
      console.error("Cache set error:", error)
    }
  },

  async invalidate(pattern: string): Promise<number> {
    try {
      const keys = await getRedis().keys(pattern)
      if (keys.length > 0) {
        await getRedis().del(...keys)
      }
      return keys.length
    } catch (error) {
      console.error("Cache invalidate error:", error)
      return 0
    }
  }
}

// Cache key helpers
export function cacheKey(table: string, filter?: string): string {
  const filterHash = filter ? hashString(filter) : "all"
  return `airtable:${table}:${filterHash}`
}

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

// TTL configuration per table (in seconds)
export const TABLE_TTL: Record<string, number> = {
  methods: 30 * 60,      // 30 minutes - static reference data
  goals: 30 * 60,        // 30 minutes
  daysOfWeek: 30 * 60,   // 30 minutes
  users: 5 * 60,         // 5 minutes
  companies: 5 * 60,     // 5 minutes
  programs: 60,          // 1 minute - dynamic data
  methodUsage: 60        // 1 minute
}
