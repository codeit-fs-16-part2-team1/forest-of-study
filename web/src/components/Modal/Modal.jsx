import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import useDialog from "../../hooks/useDialog.js";
import styles from "./Modal.module.scss";

const Modal = ({
  isOpen = true,
  title = "비밀번호 확인",
  description = "권한이 필요해요!",
  submitLabel = "확인",
  defaultPasswordVisible = false,
  errorMessage = "",
  isPending = false,
  disabled = false,
  onSubmit,
  onClose,
  className = "",
}) => {
  const id = useId();
  const dialogRef = useDialog(isOpen);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(
    defaultPasswordVisible,
  );
  const isDisabled = disabled || isPending;

  // 부모에서 닫는 경우에도 입력 원문과 보기 상태를 폐기한다.
  useEffect(() => {
    if (!isOpen) {
      setPassword("");
      setPasswordVisible(defaultPasswordVisible);
    }
  }, [isOpen, defaultPasswordVisible]);

  const handleChange = (event) => {
    const value = event.target.value;
    // 공백을 자동 삭제하지 않고, 공백이 포함된 입력 전체를 받지 않는다.
    if (/\s/u.test(value)) return;
    setPassword(value);
  };

  const handleClose = () => {
    setPassword("");
    setPasswordVisible(defaultPasswordVisible);
    onClose?.();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isDisabled || /\s/u.test(password)) return;
    // 형식 검사는 input의 required/pattern을 사용하며 서버 검증은 호출 화면이 담당한다.
    onSubmit?.(password);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className={[styles.backdrop, className].filter(Boolean).join(" ")}
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
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
          <div className={styles.field}>
            <label htmlFor={id + "-password"} className={styles.label}>
              비밀번호
            </label>
            <div
              className={[
                styles.inputBox,
                errorMessage ? styles.inputError : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                id={id + "-password"}
                className={styles.input}
                type={passwordVisible ? "text" : "password"}
                value={password}
                onChange={handleChange}
                onPaste={(event) => {
                  if (/\s/u.test(event.clipboardData.getData("text"))) {
                    event.preventDefault();
                  }
                }}
                placeholder="비밀번호를 입력해 주세요"
                autoComplete="off"
                minLength={4}
                maxLength={20}
                pattern="[A-Za-z0-9!@#$%^&*]{4,20}"
                required
                disabled={isDisabled}
                aria-invalid={Boolean(errorMessage)}
                aria-describedby={errorMessage ? id + "-error" : undefined}
              />
              <button
                className={[
                  styles.visibilityButton,
                  passwordVisible ? styles.visibilityOn : styles.visibilityOff,
                ].join(" ")}
                type="button"
                onClick={() => setPasswordVisible((visible) => !visible)}
                aria-label={
                  passwordVisible ? "비밀번호 숨기기" : "비밀번호 보기"
                }
                aria-pressed={passwordVisible}
                disabled={isDisabled}
              />
            </div>
            {errorMessage && (
              <p id={id + "-error"} className={styles.error} role="alert">
                {errorMessage}
              </p>
            )}
          </div>
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
          onClick={handleClose}
        >
          나가기
        </button>
      </section>
    </div>,
    document.body,
  );
};

export default Modal;
