import { Link, useLocation } from "react-router";
import styles from "./Header.module.scss";

const Header = () => {
  const { pathname } = useLocation();
  const isMainPage = pathname === "/";

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <h1 className={styles.logo}>
          <Link to="/">
            <span className={styles.wordmark}>공부의 숲</span>
            <svg className={styles.sprout} viewBox="0 0 48 40" fill="none" aria-hidden="true" focusable="false">
              <path d="M24 36C24 25 24 19 16 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M23 24C24 15 30 9 38 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M22 20C10 21 5 13 5 4C15 3 24 10 22 20Z" fill="#b6c77a" />
              <path d="M25 22C24 10 33 3 44 4C43 15 36 23 25 22Z" fill="#8fa65d" />
              <path d="M9 8L19 17M29 18L40 8" stroke="#d6deaa" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Link>
        </h1>
        {isMainPage && (
          <Link to="/reg" className={styles.createStudyBtn}>
            스터디 만들기
          </Link>
        )}
      </div>
    </header>
  );
};

export default Header;