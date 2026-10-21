import { Link } from "react-router";
import { studyBackgrounds } from "../../constants/studyBackgrounds.js";
import { getStudyDays } from "../../utils/studyDate.js";
import { getCustomBackgroundTheme, getPatternTextBackground, getStudyTextColor, isValidStudyPattern } from "../../utils/studyBackground.js";
import StudyPatternLayer, { StudyPatternText } from "../StudyPatternLayer/StudyPatternLayer.jsx";
import studyCardPoint from "../../assets/studyCardPoint.svg";
import styles from "./StudyCard.module.scss";
import BookmarkButton from "../BookmarkButton/BookmarkButton.jsx";

const StudyCard = ({ study, onShowToast, onBookmarkRemoved }) => {
  const background = studyBackgrounds.find(
    ({ key }) => key === study.backgroundKey
  );

  const hasImage = Boolean(background?.image);
  const customTheme = study.backgroundKey === "custom"
    ? getCustomBackgroundTheme(study.backgroundColor)
    : null;
  const hasPattern = customTheme !== null && isValidStudyPattern(study.patternKey, study.patternColor);
  const manualTextColor = getStudyTextColor(study.backgroundKey, study.textColor);
  const contentBackground = getPatternTextBackground(study.backgroundColor, manualTextColor);
  const daysBackground = getPatternTextBackground(study.backgroundColor);

  return (
    <article
      className={[styles.card, hasImage && styles.imageCard, customTheme && styles.customCard, hasPattern && styles.patternCard].filter(Boolean).join(" ")}
      style={{
        "--study-accent": customTheme?.textColor ?? (hasImage
          ? "var(--color-white)"
          : `var(--color-${background?.key ?? "green"}-text)`),
        backgroundColor: customTheme?.backgroundColor ?? background?.color,
        "--custom-text-color": customTheme?.textColor,
        "--custom-content-color": manualTextColor ?? customTheme?.textColor,
        "--custom-badge-background": customTheme?.badgeBackground,
        backgroundImage: hasImage
          ? `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)),
             url("${background.image}")`
          : undefined,
      }}
    >
      {hasPattern && <StudyPatternLayer patternKey={study.patternKey} patternColor={study.patternColor} />}
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
            <StudyPatternText active={hasPattern} backgroundColor={contentBackground}>
              <span className={styles.nickname}>{study.nickname}</span>
              의 {study.name}
            </StudyPatternText>
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
        <StudyPatternText active={hasPattern} backgroundColor={daysBackground}>
          {getStudyDays(study.createdAt)}일째 진행 중
        </StudyPatternText>
      </p>

      <p className={styles.introduction}>
        <StudyPatternText active={hasPattern} backgroundColor={contentBackground}>
          {study.introduction}
        </StudyPatternText>
      </p>

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
