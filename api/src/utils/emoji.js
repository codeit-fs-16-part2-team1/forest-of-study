// Node의 Unicode 이모지 시퀀스를 검사한다. 선택기/Node 버전 변경 시 허용 범위를 함께 확인한다.
const emojiPattern = /^\p{RGI_Emoji}$/v;
const skinTonePattern = /[\u{1F3FB}-\u{1F3FF}]/gu;

// ADR-064: 피부색만 제거한다. VS16·ZWJ·성별·다른 이모지 종류는 합치지 않는다.
export const normalizeEmoji = (emoji) => emoji.replace(skinTonePattern, "");

export const isValidEmoji = (value) => {
  if (typeof value !== "string" || normalizeEmoji(value) === "") return false;
  // 전체 문자열이 하나의 이모지여야 한다. 앞뒤 공백도 허용하지 않는다.
  return emojiPattern.exec(value)?.[0] === value;
};
