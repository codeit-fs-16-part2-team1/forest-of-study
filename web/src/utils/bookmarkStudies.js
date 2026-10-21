import { isValidStudyId } from "./studyNavigation.js";

export const BOOKMARK_STUDIES_KEY = "forest-of-study:bookmark-study-ids";
export const BOOKMARK_CHANGE_EVENT = "forest-of-study:bookmarks-changed";
const BOOKMARK_LIMIT = 3;

export const readBookmarkStudyIds = () => {
  const stored = JSON.parse(window.localStorage.getItem(BOOKMARK_STUDIES_KEY));
  return Array.isArray(stored)
    ? [...new Set(stored.filter(isValidStudyId).map((id) => id.toLowerCase()))].slice(0, BOOKMARK_LIMIT)
    : [];
};

export const toggleBookmarkStudy = (studyId) => {
  if (!isValidStudyId(studyId)) return "error";
  try {
    const id = studyId.toLowerCase();
    const ids = readBookmarkStudyIds();
    const isBookmarked = ids.includes(id);
    if (!isBookmarked && ids.length >= BOOKMARK_LIMIT) return "limit";
    const nextIds = isBookmarked ? ids.filter((savedId) => savedId !== id) : [...ids, id];
    window.localStorage.setItem(BOOKMARK_STUDIES_KEY, JSON.stringify(nextIds));
    window.dispatchEvent(new Event(BOOKMARK_CHANGE_EVENT));
    return isBookmarked ? "removed" : "added";
  } catch {
    // 읽기·저장 실패 시 기존 데이터와 표시 상태를 유지한다.
    return "error";
  }
};

// 정상 다건 응답에서 빠진 ID만 정리하며, 조회 후 추가된 ID는 보존한다.
export const pruneBookmarkStudies = (requestedIds, returnedIds) => {
  const existing = new Set(returnedIds.map((id) => id.toLowerCase()));
  const missing = new Set(requestedIds.filter((id) => !existing.has(id)));
  if (missing.size === 0) return;
  try {
    const ids = readBookmarkStudyIds();
    const nextIds = ids.filter((id) => !missing.has(id));
    if (nextIds.length === ids.length) return;
    window.localStorage.setItem(BOOKMARK_STUDIES_KEY, JSON.stringify(nextIds));
    window.dispatchEvent(new Event(BOOKMARK_CHANGE_EVENT));
  } catch {
    // 정리에 실패해도 정상 조회된 카드는 표시한다.
  }
};

// 생성 성공 컨펌에서는 기존 북마크를 해제하지 않는다.
export const addBookmarkStudy = (studyId) => {
  if (!isValidStudyId(studyId)) return "error";
  try {
    const id = studyId.toLowerCase();
    const ids = readBookmarkStudyIds();
    if (ids.includes(id)) return "existing";
    if (ids.length >= BOOKMARK_LIMIT) return "limit";
    window.localStorage.setItem(BOOKMARK_STUDIES_KEY, JSON.stringify([...ids, id]));
    window.dispatchEvent(new Event(BOOKMARK_CHANGE_EVENT));
    return "added";
  } catch {
    return "error";
  }
};

// 서버 삭제 성공 후 호출하며, 저장 실패가 삭제 완료 처리를 막지 않게 한다.
export const removeBookmarkStudy = (studyId) => {
  if (!isValidStudyId(studyId)) return false;
  try {
    const id = studyId.toLowerCase();
    const ids = readBookmarkStudyIds();
    if (!ids.includes(id)) return true;
    window.localStorage.setItem(BOOKMARK_STUDIES_KEY, JSON.stringify(ids.filter((savedId) => savedId !== id)));
    window.dispatchEvent(new Event(BOOKMARK_CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
};
