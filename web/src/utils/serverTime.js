const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const KOREAN_OFFSET_MS = 9 * 60 * MINUTE_MS;

export const getServerTime = (clock, now = Date.now()) => new Date(
  Date.parse(clock.serverTime) + now - clock.receivedAt,
);

export const getServerMinute = (clock, now = Date.now()) =>
  Math.floor(getServerTime(clock, now).getTime() / MINUTE_MS) * MINUTE_MS;

export const getNextServerMinuteDelay = (clock, now = Date.now()) =>
  MINUTE_MS - ((getServerTime(clock, now).getTime() % MINUTE_MS + MINUTE_MS) % MINUTE_MS);

export const getNextKoreanMidnightDelay = (clock, now = Date.now()) => {
  const koreanTime = getServerTime(clock, now).getTime() + KOREAN_OFFSET_MS;
  return DAY_MS - ((koreanTime % DAY_MS + DAY_MS) % DAY_MS);
};
