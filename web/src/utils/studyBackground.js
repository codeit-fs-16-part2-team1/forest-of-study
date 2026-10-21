import { studyPastelColors } from "../constants/studyPastelColors.js";

export const isValidBackgroundColor = (value) =>
  typeof value === "string" && value.length === 7 && /^#[0-9a-fA-F]{6}$/.test(value);

export const isValidStudyPatternKey = (value) =>
  ["dots", "waves", "stripes", "leaves", "paper"].includes(value);

export const isValidStudyPattern = (patternKey, patternColor) =>
  isValidStudyPatternKey(patternKey) && isValidBackgroundColor(patternColor);

const getLuminance = (channels) => {
  const [red, green, blue] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

export const getCustomBackgroundTheme = (color) => {
  if (!isValidBackgroundColor(color)) return null;

  const channels = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
  const luminance = getLuminance(channels);
  // colors.css의 진한 글자색(#14151a)과 흰색 중 대비가 더 높은 쪽을 사용한다.
  const darkLuminance = getLuminance([20, 21, 26]);
  const darkContrast = (Math.max(luminance, darkLuminance) + 0.05)
    / (Math.min(luminance, darkLuminance) + 0.05);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const useWhiteText = whiteContrast > darkContrast;
  const textColor = useWhiteText ? "var(--color-white)" : "var(--color-black-dark)";
  const pastel = studyPastelColors.find((pastel) => pastel.color === color.toLowerCase());

  return {
    backgroundColor: color.toLowerCase(),
    textColor,
    // 이전에 저장한 팔레트 밖 색상은 자동 대비 색상으로 표시한다.
    accentColor: pastel?.accentColor ?? textColor,
    badgeBackground: useWhiteText ? "rgb(0 0 0 / 40%)" : "rgb(255 255 255 / 50%)",
  };
};

