import { createReadStream, existsSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PORT } from "./config.js";
import { BusPassStore, openDatabase } from "./db.js";
import { calculateFare, listCatalog } from "./pricing.js";
import { createPassToken, verifyPassToken } from "./token.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(__dirname, "../public");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

export function createApp(options = {}) {
  const dbPath = options.dbPath || process.env.DB_PATH || resolve(__dirname, "../data/bus-pass.sqlite");
  const signingSecret = options.signingSecret || process.env.SIGNING_SECRET || "dev-only-change-me";
  const adminKey = options.adminKey || process.env.ADMIN_KEY || "admin-dev-key";
  const store = options.store || new BusPassStore(openDatabase(dbPath));

  return createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const path = url.pathname;

      if (req.method === "GET" && path === "/healthz") return sendJson(res, 200, { ok: true });
      if (req.method === "GET" && path === "/readyz") return sendJson(res, 200, { ready: true });
      if (req.method === "GET" && path === "/api/routes") return sendJson(res, 200, listCatalog());

      if (req.method === "POST" && path === "/api/quote") {
        const body = await readJson(req);
        return sendJson(res, 200, calculateFare(body));
      }

      if (req.method === "POST" && path === "/api/bookings") {
        const body = await readJson(req);
        validateBookingInput(body);

        const fare = calculateFare({
          routeId: body.routeId,
          passType: body.passType,
          riderType: body.riderType
        });
        const user = store.upsertUser(body.user);
        const booking = store.createBooking({
          user,
          routeId: body.routeId,
          passType: body.passType,
          riderType: body.riderType,
          fare,
          idempotencyKey: body.idempotencyKey
        });
        const qrToken = createPassToken(booking, signingSecret);

        return sendJson(res, 201, {
          message: "Booking confirmed",
          pass: publicPassResponse(booking, user, qrToken),
          pricing: fare,
          safeguards: [
            "Fare was calculated on the server; client-supplied prices are ignored.",
            "Pass is tied to the purchaser email and signed with an HMAC token.",
            "Idempotency key prevents duplicate charges during retries."
          ]
        });
      }

      const bookingMatch = path.match(/^\/api\/bookings\/([^/]+)$/);
      if (req.method === "GET" && bookingMatch) {
        const passId = decodeURIComponent(bookingMatch[1]);
        const booking = store.findBookingWithUser(passId);
        if (!booking) return sendJson(res, 404, { error: "Pass not found" });

        const requesterEmail = String(req.headers["x-user-email"] || "").trim().toLowerCase();
        if (requesterEmail !== booking.user.email) {
          return sendJson(res, 403, { error: "Pass can only be viewed by its purchaser" });
        }

        const qrToken = createPassToken(booking, signingSecret);
        return sendJson(res, 200, { pass: publicPassResponse(booking, booking.user, qrToken) });
      }

      if (req.method === "POST" && path === "/api/passes/validate") {
        const body = await readJson(req);
        const payload = verifyPassToken(body.qrToken, signingSecret);
        const booking = store.findBookingByPassId(payload.passId);
        if (!booking) return sendJson(res, 404, { valid: false, reason: "Pass does not exist" });
        if (booking.status !== "ACTIVE") return sendJson(res, 409, { valid: false, reason: `Pass is ${booking.status}` });
        if (booking.fareCents !== payload.fareCents || booking.userId !== payload.userId) {
          return sendJson(res, 409, { valid: false, reason: "Token does not match issued pass" });
        }
        return sendJson(res, 200, {
          valid: true,
          passId: booking.passId,
          routeId: booking.routeId,
          passType: booking.passType,
          expiresAt: booking.expiresAt
        });
      }

      const revokeMatch = path.match(/^\/api\/passes\/([^/]+)\/revoke$/);
      if (req.method === "POST" && revokeMatch) {
        if (req.headers["x-admin-key"] !== adminKey) {
          return sendJson(res, 403, { error: "Admin key required" });
        }
        const passId = decodeURIComponent(revokeMatch[1]);
        const booking = store.revokePass(passId);
        if (!booking) return sendJson(res, 404, { error: "Active pass not found" });
        return sendJson(res, 200, { message: "Pass revoked", pass: booking });
      }

      if (req.method === "GET") {
        return serveStatic(path, res);
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      const status = error.statusCode || 500;
      sendJson(res, status, { error: status === 500 ? "Internal server error" : error.message });
    }
  });
}

function validateBookingInput(body) {
  const user = body.user || {};
  const required = [
    ["routeId", body.routeId],
    ["passType", body.passType],
    ["riderType", body.riderType],
    ["idempotencyKey", body.idempotencyKey],
    ["user.name", user.name],
    ["user.email", user.email],
    ["user.phone", user.phone]
  ];
  const missing = required.filter(([, value]) => !String(value || "").trim()).map(([name]) => name);
  if (missing.length > 0) {
    const error = new Error(`Missing required fields: ${missing.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
  if (!String(user.email).includes("@")) {
    const error = new Error("A valid email is required");
    error.statusCode = 400;
    throw error;
  }
}

function publicPassResponse(booking, user, qrToken) {
  return {
    passId: booking.passId,
    status: booking.status,
    routeId: booking.routeId,
    passType: booking.passType,
    riderType: booking.riderType,
    fareCents: booking.fareCents,
    currency: booking.currency,
    pricingRuleVersion: booking.pricingRuleVersion,
    issuedAt: booking.issuedAt,
    expiresAt: booking.expiresAt,
    owner: {
      name: user.name,
      email: user.email
    },
    qrToken
  };
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON body");
    error.statusCode = 400;
    throw error;
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function serveStatic(path, res) {
  const safePath = path === "/" ? "/index.html" : path;
  const filePath = resolve(join(publicDir, safePath));
  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    return sendJson(res, 404, { error: "Not found" });
  }
  res.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "public, max-age=300"
  });
  createReadStream(filePath).pipe(res);
}

if (process.argv[1] && basename(process.argv[1]) === "server.js") {
  const port = Number(process.env.PORT || DEFAULT_PORT);
  createApp().listen(port, () => {
    console.log(`Cloud bus pass system listening on http://localhost:${port}`);
  });
}
