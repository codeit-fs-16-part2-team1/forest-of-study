import { useLocation } from "react-router";
import sprout from "../../assets/watercolor/sprout.png";
import bookSpirit from "../../assets/watercolor/book-spirit.png";
import styles from "./ForestScene.module.scss";

const ForestScene = () => {
  const { pathname } = useLocation();
  if (
    pathname === "/challenge" || pathname === "/challenge/" ||
    pathname === "/routines" || pathname === "/routines/"
  ) return null;
  const character = pathname === "/" ? sprout : bookSpirit;

  return (
    <div className={styles.scene} aria-hidden="true">
      <img src={character} alt="" width="1254" height="1254" decoding="async" draggable="false" />
    </div>
  );
};

export default ForestScene;
