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
