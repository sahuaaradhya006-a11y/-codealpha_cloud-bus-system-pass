import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/server.js";

async function withServer(fn) {
  const server = createApp({
    dbPath: ":memory:",
    signingSecret: "test-secret",
    adminKey: "test-admin"
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const body = await response.json();
  return { response, body };
}

const bookingPayload = {
  routeId: "R101",
  passType: "DAILY",
  riderType: "ADULT",
  amountCents: 1,
  idempotencyKey: "retry-safe-001",
  user: {
    name: "Aarav Mehta",
    email: "aarav@example.com",
    phone: "+1 555 0100"
  }
};

test("booking ignores client-supplied price and issues a signed pass", async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await request(baseUrl, "/api/bookings", {
      method: "POST",
      body: JSON.stringify(bookingPayload)
    });

    assert.equal(response.status, 201);
    assert.equal(body.pass.fareCents, 2567);
    assert.notEqual(body.pass.fareCents, bookingPayload.amountCents);
    assert.match(body.pass.qrToken, /^[^.]+\.[^.]+$/);
  });
});

test("idempotency key returns the same pass for retries", async () => {
  await withServer(async (baseUrl) => {
    const first = await request(baseUrl, "/api/bookings", {
      method: "POST",
      body: JSON.stringify(bookingPayload)
    });
    const second = await request(baseUrl, "/api/bookings", {
      method: "POST",
      body: JSON.stringify(bookingPayload)
    });

    assert.equal(first.body.pass.passId, second.body.pass.passId);
  });
});

test("validator rejects tampered tokens and revoked passes", async () => {
  await withServer(async (baseUrl) => {
    const booked = await request(baseUrl, "/api/bookings", {
      method: "POST",
      body: JSON.stringify(bookingPayload)
    });
    const token = booked.body.pass.qrToken;
    const tampered = `${token.slice(0, -2)}xx`;

    const badValidation = await request(baseUrl, "/api/passes/validate", {
      method: "POST",
      body: JSON.stringify({ qrToken: tampered })
    });
    assert.equal(badValidation.response.status, 401);

    const goodValidation = await request(baseUrl, "/api/passes/validate", {
      method: "POST",
      body: JSON.stringify({ qrToken: token })
    });
    assert.equal(goodValidation.response.status, 200);
    assert.equal(goodValidation.body.valid, true);

    const revoked = await request(baseUrl, `/api/passes/${booked.body.pass.passId}/revoke`, {
      method: "POST",
      headers: { "x-admin-key": "test-admin" }
    });
    assert.equal(revoked.response.status, 200);

    const afterRevoke = await request(baseUrl, "/api/passes/validate", {
      method: "POST",
      body: JSON.stringify({ qrToken: token })
    });
    assert.equal(afterRevoke.response.status, 409);
    assert.equal(afterRevoke.body.valid, false);
  });
});
