import { isValidStudyId } from "./studyNavigation.js";

export const RECENT_STUDIES_KEY = "forest-of-study:recent-study-ids";
const RECENT_LIMIT = 3;

const normalizeIds = (ids) => Array.isArray(ids)
  ? [...new Set(ids.filter(isValidStudyId).map((id) => id.toLowerCase()))].slice(0, RECENT_LIMIT)
  : [];

export const readRecentStudyIds = () => {
  try {
    return normalizeIds(JSON.parse(window.localStorage.getItem(RECENT_STUDIES_KEY)));
  } catch {
    // 저장소 차단·손상된 JSON 때문에 공개 화면이 중단되지 않게 한다.
    return [];
  }
};

const writeRecentStudyIds = (ids) => {
  try {
    window.localStorage.setItem(RECENT_STUDIES_KEY, JSON.stringify(normalizeIds(ids)));
  } catch {
    // 저장소를 사용할 수 없어도 상세 조회와 목록 표시는 유지한다.
  }
};

export const recordRecentStudy = (id) => {
  if (!isValidStudyId(id)) return;
  writeRecentStudyIds([id, ...readRecentStudyIds()]);
};

export const removeRecentStudy = (id) => {
  if (!isValidStudyId(id)) return;
  writeRecentStudyIds(readRecentStudyIds().filter((savedId) => savedId !== id.toLowerCase()));
};

export const pruneRecentStudies = (requestedIds, returnedIds) => {
  const existing = new Set(returnedIds.map((id) => id.toLowerCase()));
  const missing = new Set(requestedIds.filter((id) => !existing.has(id)));
  // 조회 중 다른 탭이 추가한 ID는 이번 응답의 정리 대상에서 제외한다.
  writeRecentStudyIds(readRecentStudyIds().filter((id) => !missing.has(id)));
};
