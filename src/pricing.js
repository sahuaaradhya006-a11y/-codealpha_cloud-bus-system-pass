import { CURRENCY, PASS_TYPES, PRICING_RULE_VERSION, RIDER_TYPES, ROUTES } from "./config.js";

export function listCatalog() {
  return {
    routes: Object.values(ROUTES),
    passTypes: Object.values(PASS_TYPES),
    riderTypes: Object.values(RIDER_TYPES),
    currency: CURRENCY,
    pricingRuleVersion: PRICING_RULE_VERSION
  };
}

export function calculateFare({ routeId, passType, riderType }) {
  const route = ROUTES[routeId];
  const pass = PASS_TYPES[passType];
  const rider = RIDER_TYPES[riderType];

  if (!route) throw validationError(`Unknown route: ${routeId}`);
  if (!pass) throw validationError(`Unknown pass type: ${passType}`);
  if (!rider) throw validationError(`Unknown rider type: ${riderType}`);

  const singleRideCents = route.baseFareCents + route.distanceKm * route.perKmCents;
  const grossCents = singleRideCents * pass.rideMultiplier;
  const passDiscountCents = Math.round(grossCents * (pass.discountPercent / 100));
  const afterPassDiscountCents = grossCents - passDiscountCents;
  const riderDiscountCents = Math.round(afterPassDiscountCents * (rider.discountPercent / 100));
  const priceCents = Math.max(0, afterPassDiscountCents - riderDiscountCents);

  return {
    priceCents,
    currency: CURRENCY,
    ruleVersion: PRICING_RULE_VERSION,
    expiresInDays: pass.validDays,
    breakdown: {
      routeName: route.name,
      passLabel: pass.label,
      riderLabel: rider.label,
      singleRideCents,
      grossCents,
      passDiscountCents,
      riderDiscountCents
    }
  };
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
