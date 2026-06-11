import assert from "node:assert/strict";
import test from "node:test";
import { calculateFare } from "../src/pricing.js";

test("calculates pricing on the server with route, pass, and rider discounts", () => {
  const fare = calculateFare({ routeId: "R101", passType: "WEEKLY", riderType: "STUDENT" });

  assert.equal(fare.currency, "USD");
  assert.equal(fare.ruleVersion, "2026.06");
  assert.equal(fare.breakdown.singleRideCents, 755);
  assert.equal(fare.priceCents, 7927);
});

test("rejects unknown catalog values before booking", () => {
  assert.throws(
    () => calculateFare({ routeId: "BAD", passType: "WEEKLY", riderType: "STUDENT" }),
    /Unknown route/
  );
});
