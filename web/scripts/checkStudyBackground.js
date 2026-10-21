import assert from "node:assert/strict";
import { getCustomBackgroundTheme, isValidBackgroundColor } from "../src/utils/studyBackground.js";
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
console.log("사용자 지정 배경 검사 성공: HEX 입력·기존 배경 호환·밝은/어두운 배경의 글자 대비");
