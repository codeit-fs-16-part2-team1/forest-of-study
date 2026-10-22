import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import ChallengePage from "../pages/ChallengePage/ChallengePage.jsx";
import { isValidChallengeGoalMinutes } from "../utils/challengeGoal.js";
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
  const [completionMode, setCompletionMode] = useState("disconnected");
  const [completionAttempts, setCompletionAttempts] = useState(0);
  const [points, setPoints] = useState(previewStudy.points);
  const [notice, setNotice] = useState("");
  const isLoading = preview.state === "LOADING";
  const selectState = (state) => {
    const remaining = state === "READY" ? goalMinutes * 60000
      : (goalMinutes * 60 - 78) * 1000;
    setPreview(createPreviewState(state, goalMinutes, remaining));
    setNotice("");
    setShowError(false);
    setCompletionAttempts(0);
    setPoints(state === "COMPLETED"
      ? previewStudy.points + Math.floor(goalMinutes / 10) + 3
      : previewStudy.points);
  };

  const showAction = (state, label, remainingMilliseconds) => {
    const currentRemaining = preview.state === "RUNNING"
      ? Math.max(0, preview.remainingMilliseconds - (performance.now() - preview.receivedAt))
      : preview.remainingMilliseconds;
    setPreview(createPreviewState(state, goalMinutes, remainingMilliseconds ?? currentRemaining));
    setNotice(`${label} 예시 응답을 적용했습니다. API 요청은 보내지 않았습니다.`);
  };

  const completePreview = () => {
    if (!preview.challenge || !["RUNNING", "PAUSED"].includes(preview.state)) {
      return;
    }

    setCompletionAttempts((previous) => previous + 1);
    if (completionMode === "failOnce" && completionAttempts === 0) {
      setShowError(true);
      setNotice("모의 완료 첫 응답을 실패로 처리했습니다. 00:00과 총점을 유지하며 자동 재요청하지 않습니다.");
      return;
    }

    // 화면 검사용 응답 예시다. 실제 완료·지급 판정은 서버에서만 수행한다.
    // 누적 가산 대신 예시 응답의 총점을 넣어 재렌더링으로 중복 가산하지 않는다.
    const responsePoints = previewStudy.points + Math.floor(goalMinutes / 10) + 3;
    setPoints(responsePoints);
    setShowError(false);
    showAction("COMPLETED", "모의 완료 성공", 0);
  };

  return (
    <div className="challengePreview">
      <aside className="challengePreview__tools" aria-label="개발용 미리보기 설정">
        <p className="challengePreview__description">
          <strong>집중 화면 미리보기</strong>
          ISS-040~044 화면 확인용입니다. 인증·서버 저장·실제 완료 정산은 연결 전이며 아래 완료 동작도 모의 응답입니다.
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
              setShowError(false);
              setCompletionAttempts(0);
              setPoints(previewStudy.points);
            }}>
              {![10, 25, 180].includes(goalMinutes) && <option value={goalMinutes}>{goalMinutes}분</option>}
              <option value={10}>10분</option>
              <option value={25}>25분</option>
              <option value={180}>180분</option>
            </select>
          </label>
          <label>
            0초 이후 완료 예시 · ISS-043
            <select value={completionMode} onChange={(event) => {
              setCompletionMode(event.target.value);
              setCompletionAttempts(0);
              setShowError(false);
              setPoints(previewStudy.points);
              setPreview(createPreviewState("READY", goalMinutes, goalMinutes * 60000));
              setNotice("");
            }}>
              <option value="disconnected">연결 없음 · 0초 유지</option>
              <option value="success">모의 완료 성공</option>
              <option value="failOnce">모의 첫 실패 → 수동 재확인</option>
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
            setCompletionAttempts(0);
            setShowError(false);
            setPoints(previewStudy.points);
            setPreview(createPreviewState("RUNNING", goalMinutes, 3000));
            setNotice("남은 3초인 예시입니다. 선택한 완료 모드를 적용하며 실제 API 요청은 보내지 않습니다.");
          }}>
            남은 3초 예시
          </button>
        </div>
        <p className="challengePreview__help">
          창이 선택한 너비보다 좁으면 창에 맞춥니다. 시작 전 숫자를 누르면 10~180분을 입력·저장할 수 있습니다.
          0초 표시는 실제 서버 완료·포인트 지급을 의미하지 않습니다. 모의 완료 호출 횟수: {completionAttempts}회.
        </p>
        <p className="challengePreview__notice" role="status">{notice}</p>
      </aside>

      <div className={`challengePreview__frame challengePreview__frame--${width}`}>
        <ChallengePage
          study={isLoading ? undefined : previewStudy}
          challenge={preview.challenge}
          goalMinutes={goalMinutes}
          receivedAt={preview.receivedAt}
          points={points}
          onGoalMinutesChange={(minutes) => {
            if (preview.state !== "READY" || isPending || !isValidChallengeGoalMinutes(minutes)) return false;
            setGoalMinutes(minutes);
            setPreview(createPreviewState("READY", minutes, minutes * 60000));
            setNotice("목표 시간을 화면에 적용했습니다. API 요청은 보내지 않았습니다.");
            return true;
          }}
          isLoading={isLoading}
          isPending={isPending}
          error={showError ? { message: "요청 실패 표시 예시입니다. 실제 API 요청은 보내지 않았습니다." } : null}
          onRetry={() => {
            setShowError(false);
            setNotice("다시 조회 버튼의 표시만 확인했습니다. 실제 API 요청은 보내지 않았습니다.");
          }}
          onStart={() => {
            setCompletionAttempts(0);
            setShowError(false);
            showAction("RUNNING", "Start", goalMinutes * 60000);
          }}
          onPause={() => showAction("PAUSED", "일시정지")}
          onResume={() => showAction("RUNNING", "재개")}
          onReset={() => {
            setCompletionAttempts(0);
            setShowError(false);
            showAction("READY", "초기화", goalMinutes * 60000);
          }}
          onComplete={completionMode === "disconnected" ? undefined : completePreview}
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
