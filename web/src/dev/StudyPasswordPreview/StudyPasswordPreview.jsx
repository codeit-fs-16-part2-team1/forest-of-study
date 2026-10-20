import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import StudyPasswordVerification from "../../components/PasswordModal/StudyPasswordVerification.jsx";
import useStudyPassword from "../../hooks/useStudyPassword.js";
import StudyPasswordProvider from "../../contexts/StudyPasswordProvider.jsx";
import "../../styles/index.scss";
import styles from "./StudyPasswordPreview.module.scss";

const VerificationExample = ({ studyId, onLeave }) => {
  const verification = useStudyPassword(studyId);

  return (
    <>
      <section className={styles.panel}>
        <h2>확인 상태</h2>
        <p role="status">
          {verification.isVerified
            ? "확인 성공. 비밀번호는 현재 스터디의 앱 메모리에만 있습니다."
            : verification.isPending ? "서버에서 확인 중입니다." : "비밀번호 확인 전입니다."}
        </p>
        <p>아래 버튼은 확인 화면만 전환합니다. 실제 습관·집중·수정 요청은 보내지 않습니다.</p>
        {verification.error && !verification.isOpen && (
          <>
            <p role="alert">{verification.error.message}</p>
            <button type="button" onClick={verification.open} disabled={verification.isPending}>
              다시 시도
            </button>
          </>
        )}
        <div className={styles.actions}>
          <button type="button" onClick={verification.requireVerification} disabled={verification.isPending}>
            {verification.isVerified ? "비밀번호 폐기 후 다시 확인" : "비밀번호 모달 열기"}
          </button>
          <button type="button" onClick={onLeave}>확인 화면 나가기</button>
        </div>
      </section>
      <StudyPasswordVerification verification={verification} />
    </>
  );
};

const StudyPasswordPreview = () => {
  const [studyIdInput, setStudyIdInput] = useState("");
  const [studyId, setStudyId] = useState(null);
  const [page, setPage] = useState("습관");

  return (
    <main className={styles.preview}>
      <h1>ISS-033 · 비밀번호 확인 API 연결</h1>
      <p>개발용 확인 화면입니다. 기존 스터디 ID를 입력하면 공통 비밀번호 모달이 열립니다.</p>
      <p>
        모달에서 확인을 누르면 설정된 API 서버에 실제 확인 요청을 보냅니다.
        스터디를 생성·수정·삭제하지 않으며 입력 비밀번호나 API 오류 원문을 출력하지 않습니다.
      </p>
      {!studyId ? (
        <form className={styles.panel} onSubmit={(event) => {
          event.preventDefault();
          const id = studyIdInput.trim();
          if (id) setStudyId(id);
        }}>
          <label htmlFor="study-password-preview-id">기존 스터디 ID</label>
          <input
            id="study-password-preview-id"
            value={studyIdInput}
            onChange={(event) => setStudyIdInput(event.target.value)}
            placeholder="스터디 UUID"
            required
          />
          <button type="submit">비밀번호 확인 화면 열기</button>
        </form>
      ) : (
        <StudyPasswordProvider key={studyId} studyId={studyId.toLowerCase()}>
          <nav className={styles.actions} aria-label="같은 스터디의 확인 화면 이동">
            {["습관", "집중", "수정"].map((name) => (
              <button type="button" key={name} onClick={() => setPage(name)} aria-current={page === name ? "page" : undefined}>
                {name}
              </button>
            ))}
          </nav>
          <VerificationExample key={`${studyId}:${page}`} studyId={studyId} onLeave={() => setStudyId(null)} />
        </StudyPasswordProvider>
      )}
    </main>
  );
};

if (import.meta.env.DEV) {
  createRoot(document.getElementById("root")).render(
    <StrictMode><StudyPasswordPreview /></StrictMode>,
  );
}
