import { useId } from "react";
import { createPortal } from "react-dom";
import useDialog from "../../hooks/useDialog.js";
import styles from "./Modal.module.scss";

// 본문은 children으로 받고, 입력값과 제출 후 처리는 사용하는 화면이 관리한다.
const Modal = ({
  isOpen = true,
  title = "알림",
  description = "",
  children,
  submitLabel = "확인",
  closeLabel = "나가기",
  isPending = false,
  disabled = false,
  onSubmit,
  onClose,
  className = "",
}) => {
  const id = useId();
  const dialogRef = useDialog(isOpen);
  const isDisabled = disabled || isPending;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isDisabled) onSubmit?.(event);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className={[styles.backdrop, className].filter(Boolean).join(" ")}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id + "-title"}
        aria-describedby={description ? id + "-description" : undefined}
        aria-busy={isPending}
        tabIndex={-1}
      >
        <h2 id={id + "-title"} className={styles.title}>
          {title}
        </h2>
        {description && (
          <p id={id + "-description"} className={styles.description}>
            {description}
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <div className={styles.body}>{children}</div>
          <div className={styles.actions}>
            <button
              className={styles.actionButton}
              type="submit"
              disabled={isDisabled}
            >
              {submitLabel}
            </button>
          </div>
        </form>
        <button
          className={styles.exitButton}
          type="button"
          onClick={() => onClose?.()}
        >
          {closeLabel}
        </button>
      </section>
    </div>,
    document.body,
  );
};

export default Modal;
