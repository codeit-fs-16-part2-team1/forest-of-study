import styles from "./RoutineList.module.scss";

const RoutineList = ({
  routines = [],
  isLoading = false,
  errorMessage = "",
  errorTitle = "습관을 불러오지 못했어요",
  pendingRoutineIds = [],
  onRetry,
  onToggle,
}) => {
  if (isLoading) {
    return (
      <div className={styles.list} role="status" aria-label="습관을 불러오는 중이에요" aria-busy="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={styles.skeletonRow} aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className={styles.errorState}>
        <span className={styles.errorIcon} aria-hidden="true">!</span>
        <div role="alert">
          <p className={styles.errorTitle}>{errorTitle}</p>
          <p className={styles.errorDescription}>{errorMessage}</p>
        </div>
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          다시 시도
        </button>
      </div>
    );
  }

  if (routines.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyMessage}>
          아직 습관이 없어요<br />
          목록 수정을 눌러 습관을 생성해보세요
        </p>
      </div>
    );
  }

  return (
    <ul className={styles.list}>
      {routines.map((routine) => (
        <li key={routine.id}>
          <button
            type="button"
            onClick={() => onToggle?.(routine)}
            disabled={pendingRoutineIds.includes(routine.id)}
            className={[styles.routine, routine.completed && styles.checked].filter(Boolean).join(" ")}
            aria-pressed={routine.completed}
          >
            {routine.name}
          </button>
        </li>
      ))}
    </ul>
  );
};

export default RoutineList;
