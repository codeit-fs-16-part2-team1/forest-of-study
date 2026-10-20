import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import StudyReactions from "../components/reaction/StudyReactions.jsx";
import { useStudyTitleData } from "../hooks/useStudyTitleData.js";
import "../styles/index.scss";

const StudyReactionExample = ({ studyId, onReload }) => {
  const { study, isLoading, error } = useStudyTitleData(studyId);
  const [registeredReactions, setRegisteredReactions] = useState(null);

  return (
    <section style={{ display: "grid", gap: 16, padding: 24, background: "var(--color-surface)", borderRadius: 12 }}>
      <h2>{study ? `${study.nickname}의 ${study.name}` : "스터디 응원 조회"}</h2>
      {error ? (
        <p role="alert">{error.message}</p>
      ) : (
        <StudyReactions
          studyId={study?.id}
          isLoading={isLoading}
          reactions={registeredReactions ?? study?.reactions ?? []}
          onReactionsChange={setRegisteredReactions}
        />
      )}
      <button type="button" onClick={onReload}>서버에서 다시 조회</button>
    </section>
  );
};

const ReactionPreview = () => {
  const [studyIdInput, setStudyIdInput] = useState("");
  const [selection, setSelection] = useState(null);

  const loadStudy = (event) => {
    event.preventDefault();
    const studyId = studyIdInput.trim();
    if (!studyId) return;
    setSelection((previous) => ({ studyId, revision: (previous?.revision ?? 0) + 1 }));
  };

  const reloadStudy = () => {
    setSelection((previous) => previous && ({ ...previous, revision: previous.revision + 1 }));
  };

  return (
    <main style={{ display: "grid", gap: 24, maxWidth: 800, margin: "40px auto", padding: 24 }}>
      <h1>ISS-048 · 응원 API 미리보기</h1>
      <p>
        개발용 화면입니다. 조회는 실제 상세 API를 사용하고, 선택기에서 이모지를 누르면
        설정된 API 서버의 스터디에 응원이 실제로 등록됩니다. 테스트용 스터디로 확인해주세요.
      </p>
      <p>
        비밀번호는 필요하지 않습니다. 같은 브라우저의 같은 기본 이모지는 중복 등록할 수 없으며,
        피부색만 바꿔도 같은 반응입니다. 저장소를 지우면 브라우저 식별자도 사라집니다.
      </p>
      <form onSubmit={loadStudy} style={{ display: "grid", gap: 12 }}>
        <label htmlFor="reaction-preview-study-id">테스트 스터디 ID</label>
        <input
          id="reaction-preview-study-id"
          value={studyIdInput}
          onChange={(event) => setStudyIdInput(event.target.value)}
          placeholder="스터디 UUID"
          pattern="[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}"
          maxLength={36}
          required
          style={{ padding: 12, border: "1px solid var(--color-gray-light)", borderRadius: 8, background: "var(--color-surface)" }}
        />
        <button type="submit">스터디 불러오기</button>
      </form>
      {selection && (
        <StudyReactionExample
          key={`${selection.studyId}:${selection.revision}`}
          studyId={selection.studyId}
          onReload={reloadStudy}
        />
      )}
    </main>
  );
};

if (import.meta.env.DEV) {
  createRoot(document.getElementById("root")).render(
    <StrictMode><ReactionPreview /></StrictMode>,
  );
}
