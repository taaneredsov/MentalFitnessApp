import crypto from "crypto"

/**
 * Security utilities for authentication
 *
 * This module provides cryptographically secure functions for:
 * - Token generation
 * - Secure random code generation
 * - Constant-time comparison (timing attack prevention)
 * - Brute force protection tracking
 */

/**
 * Generate a cryptographically secure random token
 * Uses crypto.randomBytes which is suitable for security-sensitive operations
 *
 * @param bytes - Number of random bytes (default 32 = 256 bits)
 * @returns Hex-encoded random token
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex")
}

/**
 * Generate a cryptographically secure 6-digit code
 * Uses crypto.randomInt instead of Math.random() for security
 *
 * @returns 6-digit string code (100000-999999)
 */
export function generateSecureCode(): string {
  // crypto.randomInt is cryptographically secure
  // Range: 100000 to 999999 (inclusive)
  const code = crypto.randomInt(100000, 1000000)
  return String(code)
}

/**
 * Hash a token using SHA-256 for secure storage
 *
 * @param token - The plain text token to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

/**
 * Hash a 6-digit code with a salt for secure storage
 * Unlike the token, we use HMAC with a secret to prevent rainbow table attacks
 * since the code has only 1M possible values
 *
 * @param code - The 6-digit code to hash
 * @returns Hex-encoded HMAC-SHA256 hash
 */
export function hashCode(code: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required")
  }
  return crypto.createHmac("sha256", secret).update(code).digest("hex")
}

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * Timing attacks work by measuring how long a comparison takes.
 * Standard string comparison returns early on the first mismatch,
 * which leaks information about how many characters matched.
 *
 * This function always takes the same amount of time regardless
 * of where (or if) the strings differ.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns True if strings are equal, false otherwise
 */
export function constantTimeCompare(a: string, b: string): boolean {
  // Convert to buffers for constant-time comparison
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)

  // If lengths differ, we still need to do a comparison to avoid
  // leaking length information through timing
  if (bufA.length !== bufB.length) {
    // Compare bufA against itself to maintain constant time
    // but return false
    crypto.timingSafeEqual(bufA, bufA)
    return false
  }

  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * In-memory rate limiter for brute force protection
 *
 * Tracks failed attempts per identifier (email) and implements
 * exponential backoff with lockout after max attempts.
 *
 * Note: This is in-memory, so it resets on server restart.
 * For production with multiple instances, use Redis or similar.
 */
interface RateLimitEntry {
  attempts: number
  firstAttempt: number
  lastAttempt: number
  lockedUntil: number | null
}

// In-memory store for rate limiting
// Key: email address, Value: rate limit tracking
const rateLimitStore = new Map<string, RateLimitEntry>()

// Configuration
const RATE_LIMIT_CONFIG = {
  maxAttempts: 5, // Lock after 5 failed attempts
  windowMs: 15 * 60 * 1000, // 15 minute window
  lockoutMs: 15 * 60 * 1000, // 15 minute lockout
  cleanupIntervalMs: 5 * 60 * 1000 // Clean up old entries every 5 minutes
}

// Periodic cleanup of old entries
let cleanupInterval: ReturnType<typeof setInterval> | null = null

function startCleanupInterval() {
  if (cleanupInterval) return

  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      // Remove entries where the window has expired and there's no active lockout
      const windowExpired = now - entry.firstAttempt > RATE_LIMIT_CONFIG.windowMs
      const lockoutExpired = !entry.lockedUntil || now > entry.lockedUntil

      if (windowExpired && lockoutExpired) {
        rateLimitStore.delete(key)
      }
    }
  }, RATE_LIMIT_CONFIG.cleanupIntervalMs)
}

// Start cleanup on module load
startCleanupInterval()

/**
 * Check if an identifier is rate limited
 *
 * @param identifier - The identifier to check (typically email)
 * @returns Object with isLimited flag and optional retryAfter timestamp
 */
export function isRateLimited(identifier: string): {
  isLimited: boolean
  retryAfter?: number
  remainingAttempts?: number
} {
  const entry = rateLimitStore.get(identifier)
  const now = Date.now()

  if (!entry) {
    return { isLimited: false, remainingAttempts: RATE_LIMIT_CONFIG.maxAttempts }
  }

  // Check if locked out
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      isLimited: true,
      retryAfter: entry.lockedUntil
    }
  }

  // Check if window has expired (reset attempts)
  if (now - entry.firstAttempt > RATE_LIMIT_CONFIG.windowMs) {
    rateLimitStore.delete(identifier)
    return { isLimited: false, remainingAttempts: RATE_LIMIT_CONFIG.maxAttempts }
  }

  // Check if max attempts reached
  if (entry.attempts >= RATE_LIMIT_CONFIG.maxAttempts) {
    // Set lockout if not already set
    if (!entry.lockedUntil) {
      entry.lockedUntil = now + RATE_LIMIT_CONFIG.lockoutMs
    }
    return {
      isLimited: true,
      retryAfter: entry.lockedUntil
    }
  }

  return {
    isLimited: false,
    remainingAttempts: RATE_LIMIT_CONFIG.maxAttempts - entry.attempts
  }
}

/**
 * Record a failed verification attempt
 *
 * @param identifier - The identifier (typically email)
 */
export function recordFailedAttempt(identifier: string): void {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  if (!entry) {
    rateLimitStore.set(identifier, {
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now,
      lockedUntil: null
    })
    return
  }

  // Check if window has expired
  if (now - entry.firstAttempt > RATE_LIMIT_CONFIG.windowMs) {
    // Reset the entry
    rateLimitStore.set(identifier, {
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now,
      lockedUntil: null
    })
    return
  }

  // Increment attempts
  entry.attempts++
  entry.lastAttempt = now

  // Set lockout if max attempts reached
  if (entry.attempts >= RATE_LIMIT_CONFIG.maxAttempts) {
    entry.lockedUntil = now + RATE_LIMIT_CONFIG.lockoutMs
  }
}

/**
 * Clear rate limit for an identifier (call on successful verification)
 *
 * @param identifier - The identifier to clear
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier)
}

/**
 * Add random delay to prevent timing-based enumeration
 * This adds noise to response times to make timing attacks harder
 *
 * @param minMs - Minimum delay in milliseconds
 * @param maxMs - Maximum delay in milliseconds
 */
export async function randomDelay(minMs = 100, maxMs = 300): Promise<void> {
  const delay = crypto.randomInt(minMs, maxMs + 1)
  await new Promise((resolve) => setTimeout(resolve, delay))
}
