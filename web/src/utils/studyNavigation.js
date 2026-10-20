// URL에서 받은 스터디 ID의 형태만 검사하고, 존재 여부는 API로 확인한다.
export const isValidStudyId = (value) => typeof value === "string" &&
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);

// 앱 안의 이전 방문이 없으면 직접 접속으로 보고 홈으로 이동한다.
export const goBackOrHome = (navigate) => {
  const historyIndex = window.history.state?.idx;
  if (Number.isInteger(historyIndex) && historyIndex > 0) {
    navigate(-1);
  } else {
    navigate("/", { replace: true });
  }
};

export const getStudyReturnPath = (from, currentPath) => {
  if (typeof from !== "string" || !from.startsWith("/") ||
      from.startsWith("//") || from.includes("\\")) return "/";

  const previous = new URL(from, "https://forest.local");
  const path = previous.pathname + previous.search + previous.hash;
  if (path === currentPath) return "/";
  if (previous.pathname === "/routines" &&
      !isValidStudyId(previous.searchParams.get("id"))) return "/";
  return path;
};
