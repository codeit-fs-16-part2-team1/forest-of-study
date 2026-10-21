import { useSortable } from "@dnd-kit/react/sortable";
import styles from "./RoutineModal.module.scss";

const SortableRoutineRow = ({ routine, index, disabled, children }) => {
  const { ref, handleRef, isDragging } = useSortable({
    id: routine.clientId,
    index,
    disabled,
  });

  return (
    <div
      ref={ref}
      className={[styles.routineRow, isDragging && styles.dragging].filter(Boolean).join(" ")}
    >
      <button
        ref={handleRef}
        type="button"
        className={styles.dragHandle}
        disabled={disabled}
        aria-label={`${routine.name || `${index + 1}번째 습관`} 순서 이동`}
        title="드래그하거나 스페이스와 방향키로 순서 이동"
      >
        <span aria-hidden="true">⠿</span>
      </button>
      {children}
    </div>
  );
};

export default SortableRoutineRow;
