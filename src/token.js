import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function base64UrlDecode(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function signPayload(encodedPayload, secret) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createPassToken(pass, secret) {
  const encodedPayload = base64UrlEncode({
    typ: "BUS_PASS",
    passId: pass.passId,
    userId: pass.userId,
    routeId: pass.routeId,
    passType: pass.passType,
    riderType: pass.riderType,
    fareCents: pass.fareCents,
    currency: pass.currency,
    issuedAt: pass.issuedAt,
    expiresAt: pass.expiresAt,
    nonce: randomUUID()
  });
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyPassToken(token, secret) {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) {
    throw authError("Malformed pass token");
  }

  const expected = signPayload(encodedPayload, secret);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw authError("Invalid pass token signature");
  }

  const payload = base64UrlDecode(encodedPayload);
  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    throw authError("Pass token has expired");
  }
  return payload;
}

function authError(message) {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
}
