import { Link } from "react-router";
import hero from "../../assets/watercolor/landing-sprout-reading.png";
import styles from "./LandingPage.module.scss";

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LandingPage = () => {
  return (
    <main className={styles.page} aria-labelledby="landing-title">
      <div className={styles.content}>
        <div className={styles.intro}>
          <h1 id="landing-title" className={styles.logo}>
            <span className={styles.wordmark}>공부의 숲</span>
            <svg className={styles.logoSprout} viewBox="0 0 48 40" fill="none" aria-hidden="true" focusable="false">
              <path d="M24 36C24 25 24 19 16 12M23 24C24 15 30 9 38 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M22 20C10 21 5 13 5 4C15 3 24 10 22 20Z" fill="#b6c77a" />
              <path d="M25 22C24 10 33 3 44 4C43 15 36 23 25 22Z" fill="#8fa65d" />
              <path d="M9 8L19 17M29 18L40 8" stroke="#d6deaa" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </h1>
          <p className={styles.tagline}>작은 습관이 모여, 나만의 숲이 되어요</p>
        </div>

        <div className={styles.hero} aria-hidden="true">
          <img src={hero} alt="" width="2172" height="724" fetchPriority="high" decoding="async" draggable="false" />
        </div>

        <nav className={styles.cards} aria-label="시작하기">
          <Link to="/studies" className={`${styles.card} ${styles.browse}`} aria-labelledby="landing-browse-title">
            <span className={styles.cardIcon} aria-hidden="true">
              <svg viewBox="0 0 48 48" fill="none" focusable="false">
                <path d="M24 12c-5-4-12-5-19-2v28c7-3 14-2 19 2m0-28c5-4 12-5 19-2v28c-7-3-14-2-19 2m0-28v28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className={styles.cardText}>
              <h2 id="landing-browse-title">스터디 목록</h2>
              <p>다른 사람들의 공부를 둘러보세요</p>
            </div>
            <span className={styles.arrow} aria-hidden="true"><ArrowIcon /></span>
          </Link>

          <Link to="/reg" className={`${styles.card} ${styles.create}`} aria-labelledby="landing-create-title">
            <span className={styles.cardIcon} aria-hidden="true">
              <svg viewBox="0 0 48 48" fill="none" focusable="false">
                <path d="M22 43V24C22 17 27 12 34 9" stroke="#658446" strokeWidth="3" strokeLinecap="round" />
                <path d="M21 25C9 27 4 19 4 9c11-1 19 5 17 16Z" fill="#9bb46d" />
                <path d="M23 23C21 11 30 4 42 6c0 11-9 19-19 17Z" fill="#7f9c52" />
                <path d="m9 14 10 8m7-3 11-9" stroke="#c6d49c" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="36" cy="35" r="11" fill="#dfb83e" />
                <path d="M36 30v10m-5-5h10" stroke="#fffdf2" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>
            <div className={styles.cardText}>
              <h2 id="landing-create-title">스터디 만들기</h2>
              <p>나만의 공부 공간을 만들어보세요</p>
            </div>
            <span className={styles.arrow} aria-hidden="true"><ArrowIcon /></span>
          </Link>
        </nav>

        <footer className={styles.footer}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
            <path d="M12 21V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M12 15C5 16 2 11 2 6c7-1 11 3 10 9Zm1-2C12 6 17 2 23 3c0 7-5 11-10 10Z" fill="currentColor" />
          </svg>
          <span>공부의 숲</span>
        </footer>
      </div>
    </main>
  );
};

export default LandingPage;
