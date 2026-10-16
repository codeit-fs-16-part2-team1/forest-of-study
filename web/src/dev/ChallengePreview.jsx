import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import ChallengePage from "../pages/ChallengePage.jsx";
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

// UI 확인용 예시다. 비밀번호·API·저장소·실제 타이머를 연결하지 않는다.
const ChallengePreview = () => {
  const [preview, setPreview] = useState({ state: "READY", remainingSeconds: 600 });
  const [goalMinutes, setGoalMinutes] = useState(10);
  const [width, setWidth] = useState("desktop");
  const [isPending, setIsPending] = useState(false);
  const [notice, setNotice] = useState("");
  const isLoading = preview.state === "LOADING";
  const challenge = ["RUNNING", "PAUSED", "COMPLETED"].includes(preview.state)
    ? { status: preview.state, goalMinutes, remainingSeconds: preview.remainingSeconds }
    : null;

  const selectState = (state) => {
    setPreview({
      state,
      remainingSeconds: state === "COMPLETED" ? 0
        : state === "READY" ? goalMinutes * 60 : goalMinutes * 60 - 78,
    });
    setNotice("");
  };

  const showAction = (state, label, remainingSeconds = preview.remainingSeconds) => {
    setPreview({ state, remainingSeconds });
    setNotice(`${label} 클릭을 확인했습니다. 예시 상태만 변경했으며 API 요청은 보내지 않았습니다.`);
  };

  return (
    <main className="challengePreview">
      <aside className="challengePreview__tools" aria-label="개발용 미리보기 설정">
        <p className="challengePreview__description">
          <strong>집중 화면 미리보기</strong>
          예시 스터디·고정 시간으로 표시합니다. 인증·서버 저장·카운트다운·포인트 지급은 연결 전입니다.
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
              setPreview({ state: "READY", remainingSeconds: minutes * 60 });
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
        </div>
        <p className="challengePreview__help">
          창이 선택한 너비보다 좁으면 창에 맞춥니다. 시작 전 숫자를 누르면 시간 설정 모달 틀이 열립니다.
        </p>
        <p className="challengePreview__notice" role="status">{notice}</p>
      </aside>

      <div className={`challengePreview__frame challengePreview__frame--${width}`}>
        <ChallengePage
          study={isLoading ? undefined : previewStudy}
          challenge={challenge}
          goalMinutes={goalMinutes}
          remainingSeconds={preview.remainingSeconds}
          isLoading={isLoading}
          isPending={isPending}
          onStart={() => showAction("RUNNING", "Start", goalMinutes * 60)}
          onPause={() => showAction("PAUSED", "일시정지")}
          onResume={() => showAction("RUNNING", "재개")}
          onReset={() => showAction("READY", "초기화", goalMinutes * 60)}
          onDismissCompletion={() => showAction("READY", "완료 화면 닫기", goalMinutes * 60)}
        />
      </div>
    </main>
  );
};

const PreviewDestination = ({ name }) => (
  <main className="challengePreview__destination">
    <h1>{name} 이동 확인</h1>
    <p>미리보기 안의 이동입니다. 실제 화면과 URL 연결은 공통 라우팅이 준비되면 확인합니다.</p>
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
