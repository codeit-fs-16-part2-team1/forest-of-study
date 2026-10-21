import assert from "node:assert/strict";
import { getCustomBackgroundTheme, getPatternTextBackground, getStudyTextColor, isValidBackgroundColor, isValidStudyPattern } from "../src/utils/studyBackground.js";
import { validateStudy, validateStudyFields } from "../src/utils/validateStudy.js";

// DB·API·브라우저 없이 사용자 지정 색상의 입력과 글자 대비를 검사한다.
const form = {
  nickname: "개발자", name: "색상 스터디", introduction: "색상 미리보기",
  backgroundKey: "custom", backgroundColor: "#3A8F72",
  password: "Forest123!", passwordConfirm: "Forest123!",
};

assert.deepEqual(validateStudy(form), {});
assert.deepEqual(validateStudyFields(form), {});
assert.equal(getCustomBackgroundTheme(form.backgroundColor).backgroundColor, "#3a8f72");
assert.equal(getCustomBackgroundTheme("#000000").textColor, "var(--color-white)");
assert.equal(getCustomBackgroundTheme("#ffffff").textColor, "var(--color-black-dark)");
for (const color of [undefined, null, "", "#abc", "#12345678", "rgb(1,2,3)", "red", " #123456", "#123456\n", 123456]) {
  assert.equal(isValidBackgroundColor(color), false);
  assert.equal(getCustomBackgroundTheme(color), null);
  assert.equal(typeof validateStudyFields({ ...form, backgroundColor: color }).backgroundColor, "string");
}
assert.deepEqual(validateStudyFields({ ...form, backgroundKey: "green", backgroundColor: null }), {});

const manualForm = { ...form, useDefaultTextColor: false, textColor: "#ABCDEF" };
assert.deepEqual(validateStudy(manualForm), {});
assert.equal(getStudyTextColor("custom", manualForm.textColor), "#abcdef");
for (const textColor of [undefined, null, "", "#abc", "#12345678", "red", "#123456\n", 123456]) {
  assert.equal(getStudyTextColor("custom", textColor), undefined);
  assert.equal(typeof validateStudyFields({ ...manualForm, textColor }).textColor, "string");
}
assert.equal(getStudyTextColor("green", "#abcdef"), undefined);
assert.equal(getStudyTextColor("image1", "#abcdef"), undefined);
assert.deepEqual(validateStudyFields({ ...manualForm, useDefaultTextColor: true, textColor: null }), {});
assert.deepEqual(validateStudyFields({ ...manualForm, backgroundKey: "pink", textColor: null }), {});

for (const patternKey of ["dots", "stripes", "waves"]) {
  assert.equal(isValidStudyPattern(patternKey, "#FF52DC"), true);
  assert.deepEqual(validateStudyFields({ ...form, patternKey, patternColor: "#FF52DC" }), {});
}
assert.equal(isValidStudyPattern("unknown", "#123456"), false);
assert.equal(isValidStudyPattern("dots", "#123456\n"), false);
assert.equal(typeof validateStudyFields({ ...form, patternKey: "unknown", patternColor: "#123456" }).patternKey, "string");
assert.equal(typeof validateStudyFields({ ...form, patternKey: "dots", patternColor: null }).patternColor, "string");
assert.deepEqual(validateStudyFields({ ...form, patternKey: "", patternColor: null }), {});
// 무늬와 무관한 단색 배경을 글자 뒤에 붙인다. 직접 지정 색상도 같은 규칙으로 보호한다.
assert.equal(getPatternTextBackground("#000000"), "var(--color-black-dark)");
assert.equal(getPatternTextBackground("#ffffff"), "var(--color-white)");
assert.equal(getPatternTextBackground("#000000", "#000000"), "var(--color-white)");
assert.equal(getPatternTextBackground("#ffffff", "#ffffff"), "var(--color-black-dark)");

// 카드 글자색의 실제 토큰 값과 배경의 명암비가 4.5 이상인지 확인한다.
const luminance = (hex) => {
  const [r, g, b] = hex.match(/[0-9a-f]{2}/gi).map((channel) => {
    const srgb = Number.parseInt(channel, 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
for (const color of ["#000000", "#ffffff", "#808080", "#ff0000", "#00ff00", "#0000ff", "#3a8f72"]) {
  const theme = getCustomBackgroundTheme(color);
  const textColor = theme.textColor === "var(--color-white)" ? "#ffffff" : "#14151a";
  const [lighter, darker] = [luminance(color), luminance(textColor)].sort((a, b) => b - a);
  assert.equal((lighter + 0.05) / (darker + 0.05) >= 4.5, true);
}
console.log("사용자 지정 배경 검사 성공: HEX·글자색·점/줄/물결·글자 배경·기본색 복귀·자동 대비");
