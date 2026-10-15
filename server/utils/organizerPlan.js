const ORGANIZER_PLAN_PRICE = 79000;
const ORGANIZER_MONTH_DAYS = 30;
const ORGANIZER_MONTHLY_EVENT_LIMIT = 5;
const ORGANIZER_EVENT_ATTENDEE_LIMIT = 200;

const isOrganizerActive = user => Boolean(user?.organizerExpiresAt && new Date(user.organizerExpiresAt).getTime() > Date.now());

function createOrganizerPeriod(start = new Date()) {
  const startedAt = new Date(start);
  const expiresAt = new Date(startedAt.getTime() + ORGANIZER_MONTH_DAYS * 24 * 60 * 60 * 1000);
  return { startedAt, expiresAt };
}

module.exports = { ORGANIZER_PLAN_PRICE, ORGANIZER_MONTHLY_EVENT_LIMIT, ORGANIZER_EVENT_ATTENDEE_LIMIT, isOrganizerActive, createOrganizerPeriod };
