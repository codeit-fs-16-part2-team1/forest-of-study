import sprout from "../../assets/watercolor/empty-sprout-meadow.png";
import book from "../../assets/watercolor/empty-book-meadow.png";
import styles from "./StudyEmptyState.module.scss";

const StudyEmptyState = ({ character = "sprout", children }) => {
  const illustration = character === "book" ? book : sprout;

  return (
    <div className={styles.emptyState} role="status">
      <img
        className={styles.illustration}
        src={illustration}
        alt=""
        aria-hidden="true"
        width="1536"
        height="1024"
        decoding="async"
        draggable="false"
      />
      <p className={styles.message}>{children}</p>
    </div>
  );
};

export default StudyEmptyState;
