import { describe, it, expect } from "vitest"
import crypto from "crypto"
import { verifyHmacSignature } from "../webhook-auth.js"

describe("verifyHmacSignature", () => {
  it("accepts raw hex signatures", () => {
    const body = "{\"eventId\":\"evt_1\"}"
    const secret = "test-secret"
    const digest = crypto.createHmac("sha256", secret).update(body).digest("hex")

    expect(verifyHmacSignature(body, digest, secret)).toBe(true)
  })

  it("accepts sha256=<hex> signatures", () => {
    const body = "{\"eventId\":\"evt_2\"}"
    const secret = "test-secret"
    const digest = crypto.createHmac("sha256", secret).update(body).digest("hex")

    expect(verifyHmacSignature(body, `sha256=${digest}`, secret)).toBe(true)
  })

  it("rejects invalid signatures", () => {
    expect(verifyHmacSignature("{}", "deadbeef", "secret")).toBe(false)
  })
})

