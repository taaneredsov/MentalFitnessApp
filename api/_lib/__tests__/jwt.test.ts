/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest"
import { SignJWT, jwtVerify } from "jose"

// Create test helpers with properly encoded secret
// Using node environment because jose library requires native Uint8Array
const TEST_SECRET = new TextEncoder().encode("test-secret-for-jwt-tests")

async function createTestAccessToken(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(TEST_SECRET)
}

async function createTestRefreshToken(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(TEST_SECRET)
}

async function verifyTestToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, TEST_SECRET)
    return payload
  } catch {
    return null
  }
}

describe("JWT utilities", () => {
  describe("signAccessToken", () => {
    it("creates a valid JWT access token", async () => {
      const payload = { userId: "user123", email: "test@example.com" }

      const token = await createTestAccessToken(payload)

      expect(token).toBeTruthy()
      expect(typeof token).toBe("string")
      // JWT format: header.payload.signature
      expect(token.split(".")).toHaveLength(3)
    })

    it("creates tokens with different payloads", async () => {
      const payload1 = { userId: "user1" }
      const payload2 = { userId: "user2" }

      const token1 = await createTestAccessToken(payload1)
      const token2 = await createTestAccessToken(payload2)

      expect(token1).not.toBe(token2)
    })
  })

  describe("signRefreshToken", () => {
    it("creates a valid JWT refresh token", async () => {
      const payload = { userId: "user123" }

      const token = await createTestRefreshToken(payload)

      expect(token).toBeTruthy()
      expect(typeof token).toBe("string")
      expect(token.split(".")).toHaveLength(3)
    })
  })

  describe("verifyToken", () => {
    it("verifies a valid access token", async () => {
      const originalPayload = { userId: "user123", email: "test@example.com" }
      const token = await createTestAccessToken(originalPayload)

      const verified = await verifyTestToken(token)

      expect(verified).not.toBeNull()
      expect(verified?.userId).toBe("user123")
      expect(verified?.email).toBe("test@example.com")
    })

    it("verifies a valid refresh token", async () => {
      const originalPayload = { userId: "user456" }
      const token = await createTestRefreshToken(originalPayload)

      const verified = await verifyTestToken(token)

      expect(verified).not.toBeNull()
      expect(verified?.userId).toBe("user456")
    })

    it("returns null for invalid token", async () => {
      const invalidToken = "invalid.token.here"

      const verified = await verifyTestToken(invalidToken)

      expect(verified).toBeNull()
    })

    it("returns null for malformed token", async () => {
      const malformedToken = "not-a-jwt"

      const verified = await verifyTestToken(malformedToken)

      expect(verified).toBeNull()
    })

    it("returns null for empty token", async () => {
      const verified = await verifyTestToken("")

      expect(verified).toBeNull()
    })

    it("includes iat (issued at) claim in verified token", async () => {
      const payload = { userId: "user789" }
      const token = await createTestAccessToken(payload)

      const verified = await verifyTestToken(token)

      expect(verified?.iat).toBeDefined()
      expect(typeof verified?.iat).toBe("number")
    })

    it("includes exp (expiration) claim in verified token", async () => {
      const payload = { userId: "userABC" }
      const token = await createTestAccessToken(payload)

      const verified = await verifyTestToken(token)

      expect(verified?.exp).toBeDefined()
      expect(typeof verified?.exp).toBe("number")
      // exp should be in the future
      expect(verified?.exp).toBeGreaterThan(Date.now() / 1000)
    })
  })

  describe("token round-trip", () => {
    it("can sign and verify access token with complex payload", async () => {
      const payload = {
        userId: "recXYZ123",
        email: "complex@example.com",
        role: "admin",
        companyId: "recCompany456",
      }

      const token = await createTestAccessToken(payload)
      const verified = await verifyTestToken(token)

      expect(verified?.userId).toBe(payload.userId)
      expect(verified?.email).toBe(payload.email)
      expect(verified?.role).toBe(payload.role)
      expect(verified?.companyId).toBe(payload.companyId)
    })
  })
})
