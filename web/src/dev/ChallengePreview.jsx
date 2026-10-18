import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import ChallengePage from "../pages/ChallengePage.jsx";
import "../styles/index.scss";
import "./challengePreview.scss";

const previewStudy = {
  id: "11111111-1111-4111-8111-111111111111",
  nickname: "연우",
  name: "개발공장",
  points: 310,
};
const previewLocation = `/challenge?id=${previewStudy.id}`;
const stateOptions = [
  ["READY", "시작 전"],
  ["RUNNING", "실행 중"],
  ["PAUSED", "일시정지"],
  ["COMPLETED", "완료"],
  ["LOADING", "로딩"],
];

// API 응답 형태의 예시와 수신 시각을 함께 저장한다. 실제 서버에는 요청하지 않는다.
const createPreviewState = (state, goalMinutes, remainingMilliseconds) => {
  const receivedAt = performance.now();
  const serverMilliseconds = Date.now();
  const remaining = state === "COMPLETED" ? 0 : Math.max(0, remainingMilliseconds);
  const hasChallenge = ["RUNNING", "PAUSED", "COMPLETED"].includes(state);

  return {
    state,
    receivedAt,
    remainingMilliseconds: remaining,
    challenge: hasChallenge ? {
      id: "22222222-2222-4222-8222-222222222222",
      status: state,
      goalMinutes,
      remainingSeconds: Math.ceil(remaining / 1000),
      serverTime: new Date(serverMilliseconds).toISOString(),
      endsAt: state === "RUNNING"
        ? new Date(serverMilliseconds + remaining).toISOString()
        : null,
    } : null,
  };
};

// UI 확인용 예시다. 비밀번호·API·저장소·포인트 정산을 연결하지 않는다.
const ChallengePreview = () => {
  const [preview, setPreview] = useState(() => createPreviewState("READY", 10, 600000));
  const [goalMinutes, setGoalMinutes] = useState(10);
  const [width, setWidth] = useState("desktop");
  const [isPending, setIsPending] = useState(false);
  const [showError, setShowError] = useState(false);
  const [notice, setNotice] = useState("");
  const isLoading = preview.state === "LOADING";
  const selectState = (state) => {
    const remaining = state === "READY" ? goalMinutes * 60000
      : (goalMinutes * 60 - 78) * 1000;
    setPreview(createPreviewState(state, goalMinutes, remaining));
    setNotice("");
  };

  const showAction = (state, label, remainingMilliseconds) => {
    const currentRemaining = preview.state === "RUNNING"
      ? Math.max(0, preview.remainingMilliseconds - (performance.now() - preview.receivedAt))
      : preview.remainingMilliseconds;
    setPreview(createPreviewState(state, goalMinutes, remainingMilliseconds ?? currentRemaining));
    setNotice(`${label} 예시 응답을 적용했습니다. API 요청은 보내지 않았습니다.`);
  };

  return (
    <div className="challengePreview">
      <aside className="challengePreview__tools" aria-label="개발용 미리보기 설정">
        <p className="challengePreview__description">
          <strong>집중 화면 미리보기</strong>
          예시 응답으로 카운트다운을 확인합니다. 인증·서버 저장·완료 정산은 연결 전입니다.
        </p>
        <div className="challengePreview__fields">
          <label>
            화면 상태
            <select value={preview.state} onChange={(event) => selectState(event.target.value)}>
              {stateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            본문 너비
            <select value={width} onChange={(event) => setWidth(event.target.value)}>
              <option value="desktop">PC · 1248px</option>
              <option value="tablet">태블릿 · 696px</option>
              <option value="mobile">모바일 · 344px</option>
              <option value="fluid">창 너비에 맞추기</option>
            </select>
          </label>
          <label>
            목표 예시
            <select value={goalMinutes} onChange={(event) => {
              const minutes = Number(event.target.value);
              setGoalMinutes(minutes);
              setPreview(createPreviewState("READY", minutes, minutes * 60000));
              setNotice("");
            }}>
              <option value={10}>10분</option>
              <option value={25}>25분</option>
              <option value={180}>180분</option>
            </select>
          </label>
          <label className="challengePreview__checkbox">
            <input type="checkbox" checked={isPending} onChange={(event) => setIsPending(event.target.checked)} />
            요청 처리 중 표시
          </label>
          <label className="challengePreview__checkbox">
            <input type="checkbox" checked={showError} onChange={(event) => setShowError(event.target.checked)} />
            요청 실패 표시 예시
          </label>
          <button type="button" onClick={() => {
            setPreview(createPreviewState("RUNNING", goalMinutes, 3000));
            setNotice("남은 3초인 예시 응답입니다. 0초가 되어도 완료 상태나 포인트는 변경하지 않습니다.");
          }}>
            남은 3초 예시
          </button>
        </div>
        <p className="challengePreview__help">
          창이 선택한 너비보다 좁으면 창에 맞춥니다. 시작 전 숫자를 누르면 시간 설정 모달 틀이 열립니다.
          0초 표시는 서버 완료·포인트 지급을 의미하지 않습니다.
        </p>
        <p className="challengePreview__notice" role="status">{notice}</p>
      </aside>

      <div className={`challengePreview__frame challengePreview__frame--${width}`}>
        <ChallengePage
          study={isLoading ? undefined : previewStudy}
          challenge={preview.challenge}
          goalMinutes={goalMinutes}
          receivedAt={preview.receivedAt}
          isLoading={isLoading}
          isPending={isPending}
          error={showError ? { message: "요청 실패 표시 예시입니다. 실제 API 요청은 보내지 않았습니다." } : null}
          onRetry={() => {
            setShowError(false);
            setNotice("다시 조회 버튼의 표시만 확인했습니다. 실제 API 요청은 보내지 않았습니다.");
          }}
          onStart={() => showAction("RUNNING", "Start", goalMinutes * 60000)}
          onPause={() => showAction("PAUSED", "일시정지")}
          onResume={() => showAction("RUNNING", "재개")}
          onReset={() => showAction("READY", "초기화", goalMinutes * 60000)}
          onDismissCompletion={() => showAction("READY", "완료 화면 닫기", goalMinutes * 60000)}
        />
      </div>
    </div>
  );
};

const PreviewDestination = ({ name }) => (
  <main className="challengePreview__destination">
    <h1>{name} 이동 확인</h1>
    <p>이동 확인용 미리보기입니다. 실제 홈·습관 화면은 표시하지 않습니다.</p>
    <Link to={previewLocation}>집중 화면 미리보기로 돌아가기</Link>
  </main>
);

// App·공통 라우터와 분리한다. 미리보기의 링크도 실제 브라우저 주소를 변경하지 않는다.
if (import.meta.env.DEV) {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <MemoryRouter initialEntries={[previewLocation]}>
        <Routes>
          <Route path="/challenge" element={<ChallengePreview />} />
          <Route path="/" element={<PreviewDestination name="홈" />} />
          <Route path="/routines" element={<PreviewDestination name="오늘의 습관" />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}
