import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(dbPath) {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      pass_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      route_id TEXT NOT NULL,
      pass_type TEXT NOT NULL,
      rider_type TEXT NOT NULL,
      fare_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      pricing_rule_version TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
      idempotency_key TEXT NOT NULL UNIQUE,
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
  `);
  return db;
}

export class BusPassStore {
  constructor(db) {
    this.db = db;
  }

  upsertUser({ name, email, phone }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const existing = this.db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
    if (existing) {
      return mapUser(existing);
    }

    const user = {
      id: randomUUID(),
      name: String(name || "").trim(),
      email: normalizedEmail,
      phone: String(phone || "").trim(),
      createdAt: new Date().toISOString()
    };

    this.db.prepare(`
      INSERT INTO users (id, name, email, phone, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, user.name, user.email, user.phone, user.createdAt);

    return user;
  }

  createBooking({ user, routeId, passType, riderType, fare, idempotencyKey }) {
    const existing = this.db.prepare("SELECT * FROM bookings WHERE idempotency_key = ?").get(idempotencyKey);
    if (existing) {
      return mapBooking(existing);
    }

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + fare.expiresInDays);

    const booking = {
      id: randomUUID(),
      passId: randomUUID(),
      userId: user.id,
      routeId,
      passType,
      riderType,
      fareCents: fare.priceCents,
      currency: fare.currency,
      pricingRuleVersion: fare.ruleVersion,
      status: "ACTIVE",
      idempotencyKey,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      revokedAt: null
    };

    this.db.prepare(`
      INSERT INTO bookings (
        id, pass_id, user_id, route_id, pass_type, rider_type, fare_cents, currency,
        pricing_rule_version, status, idempotency_key, issued_at, expires_at, revoked_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      booking.id,
      booking.passId,
      booking.userId,
      booking.routeId,
      booking.passType,
      booking.riderType,
      booking.fareCents,
      booking.currency,
      booking.pricingRuleVersion,
      booking.status,
      booking.idempotencyKey,
      booking.issuedAt,
      booking.expiresAt,
      booking.revokedAt
    );

    return booking;
  }

  findBookingByPassId(passId) {
    const row = this.db.prepare("SELECT * FROM bookings WHERE pass_id = ?").get(passId);
    return row ? mapBooking(row) : null;
  }

  findBookingWithUser(passId) {
    const row = this.db.prepare(`
      SELECT b.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
      FROM bookings b
      JOIN users u ON u.id = b.user_id
      WHERE b.pass_id = ?
    `).get(passId);
    if (!row) return null;
    return {
      ...mapBooking(row),
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        phone: row.user_phone
      }
    };
  }

  revokePass(passId) {
    const revokedAt = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE bookings
      SET status = 'REVOKED', revoked_at = ?
      WHERE pass_id = ? AND status = 'ACTIVE'
    `).run(revokedAt, passId);
    return result.changes > 0 ? this.findBookingByPassId(passId) : null;
  }
}

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at
  };
}

function mapBooking(row) {
  return {
    id: row.id,
    passId: row.pass_id,
    userId: row.user_id,
    routeId: row.route_id,
    passType: row.pass_type,
    riderType: row.rider_type,
    fareCents: row.fare_cents,
    currency: row.currency,
    pricingRuleVersion: row.pricing_rule_version,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at
  };
}
