import { useRef } from "react";
import useBookmarkStudyList from "../../hooks/useBookmarkStudyList.js";
import StudyCard from "../StudyCard/StudyCard.jsx";
import styles from "../../pages/MainPage.module.scss";

const BookmarkStudies = ({ onShowToast }) => {
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const { studies, isLoading, error, retry } = useBookmarkStudyList();

  const handleBookmarkRemoved = (studyId, button) => {
    if (document.activeElement !== button) return;
    const buttons = [...sectionRef.current.querySelectorAll("button[data-bookmark-study-id]")];
    const index = buttons.indexOf(button);
    if (index === -1 || button.dataset.bookmarkStudyId !== studyId) return;
    // 성공한 클릭의 렌더가 반영되기 전에 남아 있을 버튼으로 포커스를 옮긴다.
    const target = buttons[index + 1] ?? buttons[index - 1] ?? titleRef.current;
    target?.focus();
  };

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="bookmark-title" aria-busy={isLoading}>
      <h2 ref={titleRef} tabIndex={-1} id="bookmark-title" className={styles.title}>북마크한 스터디</h2>
      {isLoading && studies.length === 0 ? (
        <>
          <p className={styles.srOnly} role="status">스터디를 불러오는 중입니다.</p>
          <div className={`${styles.grid} ${styles.recentGrid}`} aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => <div key={index} className={styles.skeleton} />)}
          </div>
        </>
      ) : error ? (
        <div className={styles.empty}>
          <p role="alert">{error}</p>
          <button type="button" className={styles.retry} onClick={retry}>다시 시도</button>
        </div>
      ) : studies.length === 0 ? (
        <p className={styles.empty} role="status">북마크한 스터디가 없어요</p>
      ) : (
        <div className={`${styles.grid} ${styles.recentGrid}`}>
          {studies.map((study) => <StudyCard key={study.id} study={study} onShowToast={onShowToast} onBookmarkRemoved={handleBookmarkRemoved} />)}
        </div>
      )}
    </section>
  );
};

export default BookmarkStudies;
