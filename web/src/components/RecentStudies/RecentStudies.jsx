import useMinimumLoading from "../../hooks/useMinimumLoading.js";
import { useEffect, useRef, useState } from "react";
import useRecentStudies from "../../hooks/useRecentStudies.js";
import StudyCard from "../StudyCard/StudyCard.jsx";
import styles from "../../pages/MainPage.module.scss";

const RecentStudies = () => {
  const { studies, isLoading, error, retry } = useRecentStudies();
  const showSkeleton = useMinimumLoading(isLoading);
  const gridRef = useRef(null);
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const updateScrollEdges = () => {
      const maxScrollLeft = Math.max(0, grid.scrollWidth - grid.clientWidth);
      const scrollLeft = Math.max(0, Math.min(grid.scrollLeft, maxScrollLeft));
      const isScrollable = grid.clientWidth > 0 && maxScrollLeft > 1;
      const next = {
        left: isScrollable && scrollLeft > 1,
        right: isScrollable && maxScrollLeft - scrollLeft > 1,
      };
      setScrollEdges((previous) =>
        previous.left === next.left && previous.right === next.right
          ? previous
          : next,
      );
    };

    updateScrollEdges();
    grid.addEventListener("scroll", updateScrollEdges, { passive: true });
    window.addEventListener("resize", updateScrollEdges);
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateScrollEdges);
    observer?.observe(grid);
    Array.from(grid.children).forEach((card) => observer?.observe(card));

    return () => {
      grid.removeEventListener("scroll", updateScrollEdges);
      window.removeEventListener("resize", updateScrollEdges);
      observer?.disconnect();
    };
  }, [studies, showSkeleton, error]);

  return (
    <section className={styles.section} aria-labelledby="recent-title" aria-busy={showSkeleton}>
      <h2 id="recent-title" className={styles.title}>
        최근 조회한 스터디
      </h2>
      {showSkeleton ? (
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
        <p className={styles.empty} role="status">최근 조회한 스터디가 없어요</p>
      ) : (
        <div className={[
          styles.recentViewport,
          scrollEdges.left && styles.hasMoreLeft,
          scrollEdges.right && styles.hasMoreRight,
        ].filter(Boolean).join(" ")}>
          <div ref={gridRef} className={`${styles.grid} ${styles.recentGrid}`}>
            {studies.map((study) => <StudyCard key={study.id} study={study} />)}
          </div>
        </div>
      )}
    </section>
  );
};

export default RecentStudies;
