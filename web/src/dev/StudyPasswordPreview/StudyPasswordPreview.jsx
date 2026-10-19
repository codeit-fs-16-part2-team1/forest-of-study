import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import StudyPasswordVerification from "../../components/PasswordModal/StudyPasswordVerification.jsx";
import useStudyPassword from "../../hooks/useStudyPassword.js";
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
            ? "확인 성공. 비밀번호는 현재 페이지 메모리에만 있습니다."
            : verification.isPending ? "서버에서 확인 중입니다." : "비밀번호 확인 전입니다."}
        </p>
        <p>집중·습관·수정 페이지와 보호 데이터 요청은 연결하지 않았습니다.</p>
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
        <VerificationExample key={studyId} studyId={studyId} onLeave={() => setStudyId(null)} />
      )}
    </main>
  );
};

if (import.meta.env.DEV) {
  createRoot(document.getElementById("root")).render(
    <StrictMode><StudyPasswordPreview /></StrictMode>,
  );
}
