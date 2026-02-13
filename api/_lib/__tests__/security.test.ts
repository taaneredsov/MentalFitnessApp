/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from "vitest"
import {
  generateSecureToken,
  generateSecureCode,
  hashToken,
  hashCode,
  constantTimeCompare,
  isRateLimited,
  recordFailedAttempt,
  clearRateLimit,
} from "../security.js"

describe("Security utilities", () => {
  describe("generateSecureToken", () => {
    it("generates a 64-character hex string by default (32 bytes)", () => {
      const token = generateSecureToken()
      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[a-f0-9]+$/i)
    })

    it("generates different tokens each time", () => {
      const token1 = generateSecureToken()
      const token2 = generateSecureToken()
      expect(token1).not.toBe(token2)
    })

    it("respects custom byte length", () => {
      const token = generateSecureToken(16) // 16 bytes = 32 hex chars
      expect(token).toHaveLength(32)
    })
  })

  describe("generateSecureCode", () => {
    it("generates a 6-digit numeric code", () => {
      const code = generateSecureCode()
      expect(code).toHaveLength(6)
      expect(code).toMatch(/^\d{6}$/)
    })

    it("generates codes in valid range (100000-999999)", () => {
      for (let i = 0; i < 100; i++) {
        const code = generateSecureCode()
        const num = parseInt(code, 10)
        expect(num).toBeGreaterThanOrEqual(100000)
        expect(num).toBeLessThanOrEqual(999999)
      }
    })

    it("generates different codes (statistical test)", () => {
      const codes = new Set<string>()
      for (let i = 0; i < 100; i++) {
        codes.add(generateSecureCode())
      }
      // With 1M possible codes, 100 attempts should yield mostly unique codes
      expect(codes.size).toBeGreaterThan(95)
    })
  })

  describe("hashToken", () => {
    it("produces a 64-character hex hash (SHA-256)", () => {
      const hash = hashToken("test-token")
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[a-f0-9]+$/i)
    })

    it("produces consistent hashes for same input", () => {
      const hash1 = hashToken("same-token")
      const hash2 = hashToken("same-token")
      expect(hash1).toBe(hash2)
    })

    it("produces different hashes for different inputs", () => {
      const hash1 = hashToken("token-1")
      const hash2 = hashToken("token-2")
      expect(hash1).not.toBe(hash2)
    })
  })

  describe("hashCode", () => {
    it("produces a 64-character hex hash (HMAC-SHA256)", () => {
      const hash = hashCode("123456")
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[a-f0-9]+$/i)
    })

    it("produces consistent hashes for same input", () => {
      const hash1 = hashCode("123456")
      const hash2 = hashCode("123456")
      expect(hash1).toBe(hash2)
    })

    it("produces different hashes for different codes", () => {
      const hash1 = hashCode("123456")
      const hash2 = hashCode("654321")
      expect(hash1).not.toBe(hash2)
    })

    it("uses HMAC (different from simple SHA-256)", () => {
      const code = "123456"
      const hmacHash = hashCode(code)
      const sha256Hash = hashToken(code) // hashToken uses plain SHA-256
      expect(hmacHash).not.toBe(sha256Hash)
    })
  })

  describe("constantTimeCompare", () => {
    it("returns true for equal strings", () => {
      expect(constantTimeCompare("hello", "hello")).toBe(true)
      expect(constantTimeCompare("", "")).toBe(true)
      expect(constantTimeCompare("a", "a")).toBe(true)
    })

    it("returns false for different strings", () => {
      expect(constantTimeCompare("hello", "world")).toBe(false)
      expect(constantTimeCompare("hello", "Hello")).toBe(false)
      expect(constantTimeCompare("a", "b")).toBe(false)
    })

    it("returns false for strings of different lengths", () => {
      expect(constantTimeCompare("short", "longer string")).toBe(false)
      expect(constantTimeCompare("abc", "ab")).toBe(false)
    })

    it("handles empty string comparison with non-empty", () => {
      expect(constantTimeCompare("", "nonempty")).toBe(false)
      expect(constantTimeCompare("nonempty", "")).toBe(false)
    })

    it("works with hash-like strings", () => {
      const hash1 = hashToken("test")
      const hash2 = hashToken("test")
      const hash3 = hashToken("other")

      expect(constantTimeCompare(hash1, hash2)).toBe(true)
      expect(constantTimeCompare(hash1, hash3)).toBe(false)
    })
  })

  describe("Rate limiting", () => {
    beforeEach(() => {
      // Clear rate limit before each test
      clearRateLimit("test@example.com")
    })

    describe("isRateLimited", () => {
      it("returns not limited for new identifier", () => {
        const result = isRateLimited("new@example.com")
        expect(result.isLimited).toBe(false)
        expect(result.remainingAttempts).toBe(5)
      })

      it("decrements remaining attempts after failures", () => {
        recordFailedAttempt("test@example.com")
        const result = isRateLimited("test@example.com")
        expect(result.isLimited).toBe(false)
        expect(result.remainingAttempts).toBe(4)
      })

      it("becomes limited after max attempts", () => {
        for (let i = 0; i < 5; i++) {
          recordFailedAttempt("test@example.com")
        }
        const result = isRateLimited("test@example.com")
        expect(result.isLimited).toBe(true)
        expect(result.retryAfter).toBeDefined()
      })
    })

    describe("recordFailedAttempt", () => {
      it("tracks multiple failed attempts", () => {
        recordFailedAttempt("test@example.com")
        recordFailedAttempt("test@example.com")
        recordFailedAttempt("test@example.com")

        const result = isRateLimited("test@example.com")
        expect(result.remainingAttempts).toBe(2)
      })

      it("triggers lockout after 5 attempts", () => {
        for (let i = 0; i < 5; i++) {
          recordFailedAttempt("test@example.com")
        }

        const result = isRateLimited("test@example.com")
        expect(result.isLimited).toBe(true)
      })
    })

    describe("clearRateLimit", () => {
      it("resets rate limit for an identifier", () => {
        // Record some failures
        for (let i = 0; i < 3; i++) {
          recordFailedAttempt("test@example.com")
        }

        // Clear and check
        clearRateLimit("test@example.com")
        const result = isRateLimited("test@example.com")

        expect(result.isLimited).toBe(false)
        expect(result.remainingAttempts).toBe(5)
      })

      it("handles clearing non-existent identifier", () => {
        // Should not throw
        expect(() => clearRateLimit("nonexistent@example.com")).not.toThrow()
      })
    })

    describe("isolation between identifiers", () => {
      it("tracks different emails separately", () => {
        recordFailedAttempt("user1@example.com")
        recordFailedAttempt("user1@example.com")
        recordFailedAttempt("user2@example.com")

        const result1 = isRateLimited("user1@example.com")
        const result2 = isRateLimited("user2@example.com")

        expect(result1.remainingAttempts).toBe(3)
        expect(result2.remainingAttempts).toBe(4)
      })
    })
  })

  describe("Security edge cases", () => {
    it("generateSecureCode should never produce codes starting with 0", () => {
      // The minimum is 100000, so first digit should never be 0
      for (let i = 0; i < 100; i++) {
        const code = generateSecureCode()
        expect(code[0]).not.toBe("0")
      }
    })

    it("hashToken handles special characters", () => {
      const hash = hashToken("token with spaces & special <chars>!")
      expect(hash).toHaveLength(64)
    })

    it("hashCode handles numeric-only codes", () => {
      const hash = hashCode("000000")
      expect(hash).toHaveLength(64)
    })

    it("constantTimeCompare handles unicode", () => {
      expect(constantTimeCompare("cafe", "cafe")).toBe(true)
      expect(constantTimeCompare("cafe", "caf")).toBe(false)
    })
  })
})
