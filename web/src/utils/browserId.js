// 응원 중복 확인용 식별자다. 비밀번호 인증이나 개인 식별에 사용하지 않는다.
export const BROWSER_ID_STORAGE_KEY = "forest-of-study:reactionBrowserId";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// 사용자 등록 동작에서만 호출한다. 저장이 안 되면 임시 ID로 요청하지 않는다.
export const getOrCreateBrowserId = () => {
  const storage = window.localStorage;
  const savedId = storage.getItem(BROWSER_ID_STORAGE_KEY);

  if (typeof savedId === "string" && uuidPattern.test(savedId)) {
    return savedId;
  }

  const browserId = window.crypto.randomUUID();
  storage.setItem(BROWSER_ID_STORAGE_KEY, browserId);

  if (storage.getItem(BROWSER_ID_STORAGE_KEY) !== browserId) {
    throw new Error("응원 식별자를 저장하지 못했습니다.");
  }

  return browserId;
};
