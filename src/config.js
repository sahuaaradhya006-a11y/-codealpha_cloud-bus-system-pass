export const ROUTES = {
  R101: {
    id: "R101",
    name: "Central Station to Airport",
    distanceKm: 18,
    baseFareCents: 125,
    perKmCents: 35
  },
  R205: {
    id: "R205",
    name: "Tech Park to University",
    distanceKm: 11,
    baseFareCents: 100,
    perKmCents: 30
  },
  R310: {
    id: "R310",
    name: "North Terminal to City Hospital",
    distanceKm: 9,
    baseFareCents: 90,
    perKmCents: 28
  }
};

export const PASS_TYPES = {
  SINGLE: {
    id: "SINGLE",
    label: "Single ride",
    rideMultiplier: 1,
    discountPercent: 0,
    validDays: 1
  },
  DAILY: {
    id: "DAILY",
    label: "Daily pass",
    rideMultiplier: 4,
    discountPercent: 15,
    validDays: 1
  },
  WEEKLY: {
    id: "WEEKLY",
    label: "Weekly pass",
    rideMultiplier: 20,
    discountPercent: 25,
    validDays: 7
  },
  MONTHLY: {
    id: "MONTHLY",
    label: "Monthly pass",
    rideMultiplier: 80,
    discountPercent: 35,
    validDays: 30
  }
};

export const RIDER_TYPES = {
  ADULT: {
    id: "ADULT",
    label: "Adult",
    discountPercent: 0
  },
  STUDENT: {
    id: "STUDENT",
    label: "Student",
    discountPercent: 30
  },
  SENIOR: {
    id: "SENIOR",
    label: "Senior",
    discountPercent: 40
  }
};

export const PRICING_RULE_VERSION = "2026.06";
export const CURRENCY = "USD";
export const DEFAULT_PORT = 3000;
