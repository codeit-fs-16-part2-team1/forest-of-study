import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL?.trim();

if (!baseURL) {
  throw new Error("VITE_API_BASE_URL에 API 서버 주소와 /api를 설정해주세요.");
}

export const api = axios.create({
  baseURL: baseURL.replace(/\/+$/, ""),
  headers: {
    Accept: "application/json",
  },
});

// 서버 본문 { data, pagination? }을 유지하고, 204는 null로 반환한다.
api.interceptors.response.use((response) =>
  response.status === 204 ? null : response.data
);

const STUDIES = "/studies";

const withStudyPassword = (password) => ({
  headers: { "X-Study-Password": password },
});

export const studyApi = {
  // API-ST-01
  getList: (params) => api.get(STUDIES, { params }),

  // API-ST-02
  create: (study) => api.post(STUDIES, study),

  // API-ST-03
  getDetail: (studyId) => api.get(`${STUDIES}/${studyId}`),

  // API-ST-04 — 서버 라우트 구현 대기
  update: (studyId, study, password) =>
    api.patch(`${STUDIES}/${studyId}`, study, withStudyPassword(password)),

  // API-ST-05 — 서버 라우트 구현 대기
  remove: (studyId, password) =>
    api.delete(`${STUDIES}/${studyId}`, { data: { password } }),

  // API-ST-06
  getRoutineHistories: (studyId, weekStart) =>
    api.get(`${STUDIES}/${studyId}/routine-histories`, {
      params: { weekStart },
    }),

  // API-ST-07 — 성공 응답의 reactions는 전체 정렬 집계다.
  addReaction: (studyId, reaction) =>
    api.post(`${STUDIES}/${studyId}/reactions`, reaction),

  // API-ST-08 — ids는 UUID 배열로 전달한다.
  getByIds: (ids) =>
    api.get(`${STUDIES}/batch`, { params: { ids: ids.join(",") } }),

  // API-AU-01
  verifyPassword: (studyId, password) =>
    api.post(`${STUDIES}/${studyId}/password-verifications`, { password }),
};

export const routineApi = {
  // API-HB-01
  getList: (studyId, password) =>
    api.get(`${STUDIES}/${studyId}/routines`, withStudyPassword(password)),

  // API-HB-06 — 일괄 생성·이름·색상 변경·종료·순서 저장. 오늘 목록과 같은 형태의 응답을 받는다.
  saveBatch: (studyId, changes, password) =>
    api.patch(`${STUDIES}/${studyId}/routines/batch`, changes, withStudyPassword(password)),

  // API-HB-05 — completed: true는 체크, false는 해제다.
  setCompleted: (studyId, routineId, { recordDate, completed }, password) =>
    api.put(
      `${STUDIES}/${studyId}/routines/${routineId}/check`,
      { recordDate, completed },
      withStudyPassword(password)
    ),
};

export const challengeApi = {
  // API-FC-01
  getCurrent: (studyId, password) =>
    api.get(`${STUDIES}/${studyId}/challenges/current`, withStudyPassword(password)),

  // API-FC-02
  start: (studyId, goalMinutes, password) =>
    api.post(
      `${STUDIES}/${studyId}/challenges`,
      { goalMinutes },
      withStudyPassword(password)
    ),

  // API-FC-03
  pause: (studyId, challengeId, password) =>
    api.post(
      `${STUDIES}/${studyId}/challenges/${challengeId}/pause`,
      undefined,
      withStudyPassword(password)
    ),

  // API-FC-04
  resume: (studyId, challengeId, password) =>
    api.post(
      `${STUDIES}/${studyId}/challenges/${challengeId}/resume`,
      undefined,
      withStudyPassword(password)
    ),

  // API-FC-05
  reset: (studyId, challengeId, password) =>
    api.post(
      `${STUDIES}/${studyId}/challenges/${challengeId}/reset`,
      undefined,
      withStudyPassword(password)
    ),

  // API-FC-06
  complete: (studyId, challengeId, password) =>
    api.post(
      `${STUDIES}/${studyId}/challenges/${challengeId}/complete`,
      undefined,
      withStudyPassword(password)
    ),
};

export default api;
