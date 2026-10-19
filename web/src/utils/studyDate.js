const koreanDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const getKoreanDate = (value = new Date()) => {
  const parts = koreanDateFormatter.formatToParts(new Date(value));
  const getPart = (type) =>
    parts.find((part) => part.type === type).value;

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

export const getStudyDays = (createdAt, now = new Date()) => {
  const createdDate = getKoreanDate(createdAt);
  const currentDate = getKoreanDate(now);

  const difference =
    Date.parse(`${currentDate}T00:00:00Z`) -
    Date.parse(`${createdDate}T00:00:00Z`);

  return Math.max(1, Math.floor(difference / 86400000) + 1);
};