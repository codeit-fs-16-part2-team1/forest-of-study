import { useEffect, useId, useState } from "react";
import Modal from "../Modal/Modal.jsx";
import styles from "./PasswordModal.module.scss";

const PasswordModal = ({
  isOpen = true,
  title = "비밀번호 확인",
  description = "권한이 필요해요!",
  submitLabel = "확인",
  closeLabel = "나가기",
  defaultPasswordVisible = false,
  errorMessage = "",
  isPending = false,
  disabled = false,
  onSubmit,
  onClose,
  className = "",
}) => {
  const id = useId();
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

  const handleSubmit = () => {
    if (isDisabled || /\s/u.test(password)) return;
    // 형식 검사는 input의 required/pattern을 사용하며 서버 검증은 호출 화면이 담당한다.
    onSubmit?.(password);
  };

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      description={description}
      submitLabel={submitLabel}
      closeLabel={closeLabel}
      isPending={isPending}
      disabled={disabled}
      onSubmit={handleSubmit}
      onClose={handleClose}
      className={className}
    >
      <div>
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
    </Modal>
  );
};

export default PasswordModal;
