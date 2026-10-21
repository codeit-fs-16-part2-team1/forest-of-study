export const isValidBackgroundColor = (value) =>
  typeof value === "string" && value.length === 7 && /^#[0-9a-fA-F]{6}$/.test(value);

export const getStudyTextColor = (backgroundKey, textColor) =>
  backgroundKey === "custom" && isValidBackgroundColor(textColor)
    ? textColor.toLowerCase()
    : undefined;

export const isValidStudyPattern = (patternKey, patternColor) =>
  ["dots", "stripes", "waves"].includes(patternKey) && isValidBackgroundColor(patternColor);

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

  return {
    backgroundColor: color.toLowerCase(),
    textColor: useWhiteText ? "var(--color-white)" : "var(--color-black-dark)",
    badgeBackground: useWhiteText ? "rgb(0 0 0 / 40%)" : "rgb(255 255 255 / 50%)",
  };
};

// 지정한 글자색에는 반대 명암의 불투명 배경을 붙여 무늬가 글자 뒤로 비치지 않게 한다.
export const getPatternTextBackground = (backgroundColor, textColor = null) => {
  const manualTheme = getCustomBackgroundTheme(textColor);
  if (manualTheme) return manualTheme.textColor;
  const theme = getCustomBackgroundTheme(backgroundColor);
  if (!theme) return undefined;
  return theme.textColor === "var(--color-white)"
    ? "var(--color-black-dark)"
    : "var(--color-white)";
};
