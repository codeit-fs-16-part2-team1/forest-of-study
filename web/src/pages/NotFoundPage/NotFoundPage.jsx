import { Link, useNavigate } from "react-router";
import scene from "../../assets/watercolor/not-found-sprout-path.png";
import styles from "./NotFoundPage.module.scss";

const SproutMark = ({ className }) => (
  <svg className={className} viewBox="0 0 48 40" fill="none" aria-hidden="true" focusable="false">
    <path d="M24 36C24 25 24 19 16 12M23 24C24 15 30 9 38 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M22 20C10 21 5 13 5 4C15 3 24 10 22 20Z" fill="#b6c77a" />
    <path d="M25 22C24 10 33 3 44 4C43 15 36 23 25 22Z" fill="#8fa65d" />
    <path d="M9 8L19 17M29 18L40 8" stroke="#d6deaa" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const NotFoundPage = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    const historyIndex = window.history.state?.idx;
    if (Number.isInteger(historyIndex) && historyIndex > 0) {
      navigate(-1);
    } else {
      navigate("/studies", { replace: true });
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/studies" className={styles.logo} aria-label="공부의 숲, 스터디 목록으로">
          <span className={styles.wordmark}>공부의 숲</span>
          <SproutMark className={styles.logoSprout} />
        </Link>
      </header>

      <main className={styles.content} aria-labelledby="not-found-title">
        <p className={styles.errorCode} aria-label="404 오류">404</p>
        <img
          className={styles.scene}
          src={scene}
          alt=""
          aria-hidden="true"
          width="2172"
          height="724"
          decoding="async"
          draggable="false"
        />
        <h1 id="not-found-title" className={styles.title}>숲길을 잠시 벗어났어요</h1>
        <p className={styles.description}>찾으시는 페이지가 없거나 주소가 변경되었어요.</p>

        <nav className={styles.actions} aria-label="404 페이지 이동">
          <Link to="/studies" className={styles.primary}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
              <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            스터디 목록으로
          </Link>
          <button type="button" className={styles.secondary} onClick={handleBack}>이전 페이지</button>
        </nav>
      </main>

      <footer className={styles.footer}>
        <SproutMark className={styles.footerSprout} />
        <span>공부의 숲</span>
      </footer>
    </div>
  );
};

export default NotFoundPage;
