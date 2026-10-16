const buildChallengesPath = (studyId) =>
  `/studies/${encodeURIComponent(studyId)}/challenges`;

const buildPasswordConfig = (password) => ({
  headers: { "X-Study-Password": password },
});

// baseURL이 서버 주소 + /api인 공통 axios 인스턴스를 전달받는다.
// 비밀번호는 각 보호 요청에만 전달하고 기본 헤더·저장소·로그에 남기지 않는다.
export const createChallengeApi = (client) => {
  const changeChallenge = async (action, { studyId, challengeId, password }) => {
    const response = await client.post(
      `${buildChallengesPath(studyId)}/${encodeURIComponent(challengeId)}/${action}`,
      undefined,
      buildPasswordConfig(password),
    );

    return response.data.data;
  };

  return {
    getCurrentChallenge: async ({ studyId, password }) => {
      const response = await client.get(
        `${buildChallengesPath(studyId)}/current`,
        buildPasswordConfig(password),
      );

      return response.data.data;
    },

    startChallenge: async ({ studyId, password, goalMinutes }) => {
      const response = await client.post(
        buildChallengesPath(studyId),
        { goalMinutes },
        buildPasswordConfig(password),
      );

      return response.data.data;
    },

    pauseChallenge: (params) => changeChallenge("pause", params),
    resumeChallenge: (params) => changeChallenge("resume", params),
    resetChallenge: (params) => changeChallenge("reset", params),
    completeChallenge: (params) => changeChallenge("complete", params),
  };
};
