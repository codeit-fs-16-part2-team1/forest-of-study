import assert from "node:assert/strict";
import { normalizeEmoji, isValidEmoji } from "../src/utils/emoji.js";
import { validateCreateReaction } from "../src/schemas/reaction.js";

// 기본 실행은 DB·환경변수 없이 검사한다. --picker는 설치된 web 선택기 데이터 전체를 대조한다.
let step = "검증 인자 확인";
try {
  const args = process.argv.slice(2);
  assert.equal(args.length <= 1 && args.every((arg) => arg === "--picker"), true);
  const browserId = "44444444-4444-4444-8444-444444444444";
  step = "단일·조합·국기·키캡 이모지 허용";
  for (const emoji of ["🔥", "👍", "👍🏽", "👩🏽‍💻", "👨‍👩‍👧‍👦", "❤️", "🇰🇷", "1️⃣", "#️⃣", "©️", "🫱🏽‍🫲🏻"]) {
    assert.equal(isValidEmoji(emoji), true);
    const parsed = validateCreateReaction({ browserId, emoji });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.emoji, emoji);
  }
  step = "빈 값·문자열·복수 이모지·공백·단독 수정자 거절";
  for (const emoji of ["", " ", "abc", "1", "😀😀", " 🔥", "🔥 ", "🔥\n", "🔥\t", "🏽", "\u200d", "\ufe0f", "🇰"]) {
    assert.equal(isValidEmoji(emoji), false);
    assert.equal(validateCreateReaction({ browserId, emoji }).success, false);
  }
  for (const emoji of [null, undefined, 123, {}, []]) {
    assert.equal(isValidEmoji(emoji), false);
    assert.equal(validateCreateReaction({ browserId, emoji }).success, false);
  }
  step = "피부색만 제거·다른 종류와 표현 보존";
  for (const modifier of ["🏻", "🏼", "🏽", "🏾", "🏿"]) {
    assert.equal(normalizeEmoji("👍" + modifier), "👍");
    assert.equal(normalizeEmoji("👩" + modifier + "‍💻"), "👩‍💻");
  }
  assert.equal(normalizeEmoji("🫱🏽‍🫲🏻"), "🫱‍🫲");
  assert.equal(normalizeEmoji("❤️"), "❤️");
  assert.equal(normalizeEmoji("👨‍👩‍👧‍👦"), "👨‍👩‍👧‍👦");
  assert.notEqual(normalizeEmoji("👨🏽‍💻"), normalizeEmoji("👩🏽‍💻"));
  step = "UUID·본문 타입·추가 필드 거절";
  for (const body of [
    undefined, null, [], {}, { browserId }, { emoji: "🔥" },
    { browserId: "invalid", emoji: "🔥" }, { browserId: [browserId], emoji: "🔥" },
    { browserId, emoji: "🔥", extra: true },
  ]) assert.equal(validateCreateReaction(body).success, false);

  if (args.includes("--picker")) {
    step = "설치된 emoji-picker-react 데이터 읽기";
    const { readFile } = await import("node:fs/promises");
    const packageRoot = new URL("../../web/node_modules/emoji-picker-react/", import.meta.url);
    const pkg = JSON.parse(await readFile(new URL("package.json", packageRoot), "utf8"));
    const data = JSON.parse(await readFile(new URL("dist/data/emojis-en.json", packageRoot), "utf8"));
    assert.equal(typeof data.emojis, "object");
    const codes = new Set();
    for (const category of Object.values(data.emojis)) {
      assert.equal(Array.isArray(category), true);
      for (const emoji of category) {
        codes.add(emoji.u);
        for (const variation of emoji.v ?? []) codes.add(variation);
      }
    }
    assert.equal(codes.size > 0, true);
    step = "선택기의 모든 기본·피부색 이모지와 Node Unicode 대조";
    const rejected = [];
    for (const code of codes) {
      assert.equal(typeof code === "string" && /^[0-9a-f]+(?:-[0-9a-f]+)*$/i.test(code), true);
      const emoji = String.fromCodePoint(...code.split("-").map((part) => parseInt(part, 16)));
      if (!isValidEmoji(emoji)) rejected.push(code);
    }
    if (rejected.length > 0) {
      console.error("선택기와 서버 검사 불일치: " + JSON.stringify({
        pickerVersion: pkg.version, unicodeVersion: process.versions.unicode,
        rejectedCount: rejected.length, sampleUnifiedCodes: rejected.slice(0, 20),
      }));
    }
    assert.equal(rejected.length, 0);
    console.log("선택기 전체 대조 성공: " + pkg.version + " / " + codes.size + "개 기본·변형 코드");
  }
  console.log("응원 규칙 검사 성공: 이모지 입력·피부색 정규화·UUID·엄격한 본문. DB 연결 없음");
} catch {
  console.error("응원 규칙 검사 실패: " + step);
  if (step === "설치된 emoji-picker-react 데이터 읽기") {
    console.error("web 의존성이 설치되어 있어야 합니다. npm test의 기본 검사에는 선택기 설치가 필요하지 않습니다.");
  }
  process.exitCode = 1;
}
