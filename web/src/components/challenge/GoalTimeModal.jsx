import { useEffect, useId, useRef } from "react";
import "./goalTimeModal.scss";

// 내부 시안과 ISS-050 공통 모달을 연결하기 전까지 사용하는 시간 설정 틀이다.
const GoalTimeModal = ({ isOpen, onClose, children }) => {
  const dialogRef = useRef(null);
  const backdropPointerRef = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [isOpen]);

  const isBackdrop = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.target === event.currentTarget && (
      event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom
    );
  };

  return (
    <dialog
      ref={dialogRef}
      className="goalTimeModal"
      aria-labelledby={titleId}
      onCancel={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        backdropPointerRef.current = isBackdrop(event);
      }}
      onClick={(event) => {
        if (backdropPointerRef.current && isBackdrop(event)) {
          onClose();
        }
        backdropPointerRef.current = false;
      }}
    >
      <div className="goalTimeModal__header">
        <h2 id={titleId}>시간 설정</h2>
        <button type="button" onClick={onClose}>나가기</button>
      </div>
      <div className="goalTimeModal__content">{children}</div>
    </dialog>
  );
};

export default GoalTimeModal;
