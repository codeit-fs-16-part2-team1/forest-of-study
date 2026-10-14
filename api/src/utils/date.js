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

// 입력한 날짜가 속한 주의 월요일부터 일요일까지 날짜를 반환한다.
// Date는 날짜 계산용 UTC 자정으로만 사용하여 서버 시간대의 영향을 피한다.
export const getWeekDates = (value) => {
  if (!isValidRecordDate(value)) return null;

  const monday = new Date(`${value}T00:00:00.000Z`);
  const daysSinceMonday = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);

  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });

  // PostgreSQL에는 서기 0년이 없고 API 날짜는 네 자리 연도만 표현한다.
  if (dates.some((date) => date.startsWith("0000") || !isValidRecordDate(date))) {
    return null;
  }
  return dates;
};
