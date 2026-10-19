import { useId, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import useStudyReactions from "../../hooks/useStudyReactions.js";
import smile from "../../assets/reaction/smile.svg";
import styles from "./StudyReactions.module.scss";

const StudyReactionsContent = ({
  studyId,
  reactions = [],
  isLoading = false,
  onReactionsChange,
}) => {
  const id = useId();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const { isPending, error, addReaction } = useStudyReactions({ studyId, onReactionsChange });
  const disabled = isLoading || isPending || !studyId
    || typeof onReactionsChange !== "function";

  const handleEmojiClick = async (emojiData) => {
    if (disabled) return;
    setNotice("");

    if (await addReaction(emojiData.emoji)) {
      setNotice("응원을 보냈습니다.");
      setIsPickerOpen(false);
    }
  };

  return (
    <section className={styles.reactions} aria-labelledby={`${id}-heading`} aria-busy={isLoading || isPending}>
      <h2 id={`${id}-heading`} className={styles.srOnly}>응원</h2>
      <div className={styles.toolbar}>
        {isLoading ? (
          <div className={styles.skeletons} role="status" aria-label="응원 불러오는 중">
            {[0, 1, 2].map((index) => <span key={index} className={styles.skeleton} />)}
          </div>
        ) : reactions.length === 0 ? (
          <p className={styles.empty}>아직 응원이 없습니다.</p>
        ) : (
          <ul className={styles.list} aria-label="상위 응원 이모지">
            {reactions.map(({ emoji, count }) => (
              <li key={emoji} className={styles.badge}>
                <span className={styles.emoji} role="img" aria-label={emoji}>{emoji}</span>
                <span aria-label={`${count}개`}>{count}</span>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={isPickerOpen}
          aria-controls={`${id}-picker`}
          aria-label={isPickerOpen ? "응원 이모지 선택기 닫기" : "응원 이모지 추가"}
          disabled={disabled}
          onClick={() => setIsPickerOpen((open) => !open)}
        >
          <img src={smile} alt="" />
          {isPickerOpen ? "닫기" : "추가"}
        </button>
      </div>

      <p className={styles.status} role="status">
        {isPending ? "응원을 보내는 중입니다." : notice}
      </p>
      {error && <p className={styles.error} role="alert">{error.message}</p>}

      {isPickerOpen && (
        <div id={`${id}-picker`} className={styles.picker} role="region" aria-label="응원 이모지 선택">
          <fieldset disabled={disabled}>
            <legend className={styles.srOnly}>등록할 이모지 선택</legend>
            <EmojiPicker onEmojiClick={handleEmojiClick} />
          </fieldset>
        </div>
      )}
    </section>
  );
};

// 스터디가 바뀌면 선택기·메시지·이전 요청 문맥도 함께 새로 만든다.
const StudyReactions = (props) => (
  <StudyReactionsContent key={props.studyId ?? "missing"} {...props} />
);

export default StudyReactions;
