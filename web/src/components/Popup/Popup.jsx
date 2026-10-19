import { useId } from "react";
import { createPortal } from "react-dom";
import useDialog from "../../hooks/useDialog.js";
import styles from "./Popup.module.scss";

const Popup = ({
  isOpen = true,
  mode = "alert",
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  isPending = false,
  disabled = false,
  onClose,
  onConfirm = onClose,
  onCancel = onClose,
  className = "",
}) => {
  const id = useId();
  const dialogRef = useDialog(isOpen);
  const isConfirm = mode === "confirm";
  const isDisabled = disabled || isPending;

  // 취소 버튼과 배경 클릭은 같은 취소 동작을 사용한다.
  const handleCancel = () => {
    if (!isDisabled) onCancel?.();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className={[styles.backdrop, className].filter(Boolean).join(" ")}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        if (isConfirm) handleCancel();
        else onClose?.();
      }}
    >
      <section
        ref={dialogRef}
        className={styles.popup}
        role="dialog"
        aria-modal="true"
        aria-label={isConfirm ? "확인 요청" : "안내"}
        aria-describedby={id + "-message"}
        aria-busy={isPending}
        tabIndex={-1}
      >
        <p id={id + "-message"} className={styles.message}>
          {message}
        </p>
        <div
          className={[
            styles.actions,
            isConfirm ? styles.confirmActions : styles.alertActions,
          ].join(" ")}
        >
          {isConfirm && (
            <button
              className={[styles.actionButton, styles.cancelButton].join(" ")}
              type="button"
              onClick={handleCancel}
              disabled={isDisabled}
            >
              {cancelLabel}
            </button>
          )}
          <button
            className={styles.actionButton}
            type="button"
            onClick={() => {
              if (!isDisabled) onConfirm?.();
            }}
            disabled={isDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
};

export default Popup;
