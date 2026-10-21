import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import useDialog from "../../hooks/useDialog.js";
import { routineStickers } from "../../constants/routineStickers.js";
import styles from "./RoutineColorModal.module.scss";

const RoutineColorModal = ({ stickerColor, isSaving, onSelect, onClose }) => {
  const titleId = useId();
  const dialogRef = useDialog(true);

  useEffect(() => {
    dialogRef.current?.querySelector('[aria-pressed="true"]')?.focus();
  }, [dialogRef]);

  return createPortal(
    <div className={styles.backdrop} onClick={(event) => {
      if (event.target === event.currentTarget && !isSaving) onClose();
    }}>
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={isSaving}
        tabIndex={-1}
      >
        <h2 id={titleId} className={styles.title}>발자국 색상 선택</h2>
        <div className={styles.options}>
          {routineStickers.map((sticker, index) => (
            <button
              key={sticker}
              type="button"
              className={styles.option}
              aria-label={`발자국 색상 ${index + 1}`}
              aria-pressed={stickerColor === index + 1}
              disabled={isSaving}
              onClick={() => { if (!isSaving) onSelect(index + 1); }}
            >
              <img src={sticker} width="32" height="32" alt="" />
            </button>
          ))}
        </div>
        <button type="button" className={styles.cancel} disabled={isSaving} onClick={onClose}>
          취소
        </button>
      </section>
    </div>,
    document.body,
  );
};

export default RoutineColorModal;
