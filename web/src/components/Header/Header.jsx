import { Link, useLocation } from "react-router";
import styles from "./Header.module.scss";

const Header = () => {
  const { pathname } = useLocation();
  const isMainPage = pathname === "/";

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <h1 className={styles.logo}>
          <Link to="/">공부의 숲</Link>
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