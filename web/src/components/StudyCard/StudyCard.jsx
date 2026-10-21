import { Link } from "react-router";
import { studyBackgrounds } from "../../constants/studyBackgrounds.js";
import { getStudyDays } from "../../utils/studyDate.js";
import { getCustomBackgroundTheme, getStudyTextColor } from "../../utils/studyBackground.js";
import styles from "./StudyCard.module.scss";

const StudyCard = ({ study }) => {
  const background = studyBackgrounds.find(
    ({ key }) => key === study.backgroundKey
  );

  const hasImage = Boolean(background?.image);
  const customTheme = study.backgroundKey === "custom"
    ? getCustomBackgroundTheme(study.backgroundColor)
    : null;

  return (
    <Link
      to={`/dashboard/${study.id}`}
      className={[styles.card, hasImage && styles.imageCard, customTheme && styles.customCard].filter(Boolean).join(" ")}
      style={{
        backgroundColor: customTheme?.backgroundColor ?? background?.color,
        "--custom-text-color": customTheme?.textColor,
        "--custom-content-color": getStudyTextColor(study.backgroundKey, study.textColor) ?? customTheme?.textColor,
        "--custom-badge-background": customTheme?.badgeBackground,
        backgroundImage: hasImage
          ? `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)),
             url("${background.image}")`
          : undefined,
      }}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>
          <span className={styles.nickname}>{study.nickname}</span>
          의 {study.name}
        </h3>

        <span className={styles.points}>
          {study.points.toLocaleString("ko-KR")}P 획득
        </span>
      </div>

      <p className={styles.days}>
        {getStudyDays(study.createdAt)}일째 진행 중
      </p>

      <p className={styles.introduction}>{study.introduction}</p>

      {study.reactions?.length > 0 && (
        <ul className={styles.reactions} aria-label="상위 응원">
          {study.reactions.map(({ emoji, count }) => (
            <li key={emoji}>
              <span>{emoji}</span>
              <span>{count}</span>
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
};

export default StudyCard;
