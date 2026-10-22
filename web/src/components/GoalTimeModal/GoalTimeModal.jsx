import { useId, useState } from "react";
import Modal from "../Modal/Modal.jsx";
import { parseChallengeGoalMinutes } from "../../utils/challengeGoal.js";
import "./GoalTimeModal.scss";

const GoalTimeForm = ({ goalMinutes, onSave, onClose, disabled }) => {
  const id = useId();
  const [draft, setDraft] = useState(() => String(goalMinutes));
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (disabled || !onSave) return;

    const minutes = parseChallengeGoalMinutes(draft);
    if (minutes === null) {
      setError("목표 시간은 10~180분의 정수로 입력해주세요.");
      return;
    }

    // 저장은 페이지의 선택값만 바꾼다. 서버 저장은 이후 Start 요청에서 처리한다.
    if (onSave(minutes) !== false) onClose();
  };

  return (
    <Modal
      title="시간 설정"
      submitLabel="저장"
      closeLabel="나가기"
      disabled={disabled || !onSave}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <div className="goalTimeModal__field">
        <label htmlFor={id + "-minutes"}>목표 시간 (분)</label>
        <input
          id={id + "-minutes"}
          className="goalTimeModal__input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError("");
          }}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={id + "-help" + (error ? " " + id + "-error" : "")}
        />
        <p id={id + "-help"} className="goalTimeModal__help">10~180분 사이에서 분 단위로 설정할 수 있습니다.</p>
        {error && <p id={id + "-error"} className="goalTimeModal__error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
};

// 닫을 때 입력 컴포넌트를 제거해, 다시 열면 저장된 목표부터 입력한다.
const GoalTimeModal = ({ isOpen, goalMinutes, onSave, onClose, disabled = false }) =>
  isOpen ? <GoalTimeForm goalMinutes={goalMinutes} onSave={onSave} onClose={onClose} disabled={disabled} /> : null;

export default GoalTimeModal;
