import crypto from "crypto"

export function verifyHmacSignature(rawBody: string, signature: string, secret: string): boolean {
  // Accept either raw hex or "sha256=<hex>" format.
  const normalized = signature.startsWith("sha256=")
    ? signature.slice("sha256=".length)
    : signature
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  try {
    return crypto.timingSafeEqual(Buffer.from(normalized), Buffer.from(expected))
  } catch {
    return false
  }
}
