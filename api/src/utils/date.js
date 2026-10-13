const koreanDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// 서버의 시간대와 관계없이 한국 날짜를 YYYY-MM-DD 형식으로 반환한다.
export const getKoreanDate = (now) => {
  const parts = Object.fromEntries(
    koreanDateFormatter.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

// 형식뿐 아니라 실제 존재하는 날짜인지 확인한다(예: 2026-02-30 거절).
export const isValidRecordDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
