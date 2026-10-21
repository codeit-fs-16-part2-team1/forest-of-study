import { Link } from "react-router";
import { studyBackgrounds } from "../../constants/studyBackgrounds.js";
import { getStudyDays } from "../../utils/studyDate.js";
import studyCardPoint from "../../assets/studyCardPoint.svg";
import styles from "./StudyCard.module.scss";
import BookmarkButton from "../BookmarkButton/BookmarkButton.jsx";

const StudyCard = ({ study, onShowToast, onBookmarkRemoved }) => {
  const background = studyBackgrounds.find(
    ({ key }) => key === study.backgroundKey
  );

  const hasImage = Boolean(background?.image);

  return (
    <article
      className={`${styles.card} ${hasImage ? styles.imageCard : ""}`}
      style={{
        "--study-accent": hasImage ? "var(--color-white)" : `var(--color-${background?.key ?? "green"}-text)`,
        backgroundColor: background?.color,
        backgroundImage: hasImage
          ? `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)),
             url("${background.image}")`
          : undefined,
      }}
    >
      <Link
        to={`/dashboard/${study.id}`}
        className={styles.cardLink}
        aria-label={`${study.nickname}의 ${study.name} 상세 보기`}
      />
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <BookmarkButton
            studyId={study.id}
            onShowToast={onShowToast}
            onRemoved={onBookmarkRemoved}
            className={styles.bookmarkButton}
            activeClassName={styles.isBookmarked}
          />

          <h3 className={styles.title}>
            <span className={styles.nickname}>{study.nickname}</span>
            의 {study.name}
          </h3>
        </div>

        <span className={styles.points}>
          <span className={styles.pointIcon} aria-hidden="true">
            <img src={studyCardPoint} alt="" />
          </span>
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
    </article>
  );
};

export default StudyCard;
