// api.js의 challengeApi를 전달받는다. 공통 인터셉터가 Axios 응답을 이미 풀었으므로
// 여기서는 서버 본문의 { data }만 한 번 꺼낸다. 요청 경로·보호 헤더는 공통 모듈이 담당한다.
export const createChallengeApi = (requests) => {
  const changeChallenge = async (action, { studyId, challengeId, password }) => {
    const response = await requests[action](studyId, challengeId, password);
    return response.data;
  };

  return {
    getCurrentChallenge: async ({ studyId, password }) => {
      const response = await requests.getCurrent(studyId, password);
      return response.data;
    },

    startChallenge: async ({ studyId, password, goalMinutes }) => {
      const response = await requests.start(studyId, goalMinutes, password);
      return response.data;
    },

    pauseChallenge: (params) => changeChallenge("pause", params),
    resumeChallenge: (params) => changeChallenge("resume", params),
    resetChallenge: (params) => changeChallenge("reset", params),
    completeChallenge: (params) => changeChallenge("complete", params),
  };
};
