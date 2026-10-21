import { studyPatterns } from "../../constants/studyPatterns.js";
import { isValidBackgroundColor } from "../../utils/studyBackground.js";
import styles from "./StudyPatternLayer.module.scss";

const StudyPatternLayer = ({ patternKey, patternColor }) => {
  const pattern = studyPatterns.find(({ key }) => key === patternKey);
  if (!pattern || !isValidBackgroundColor(patternColor)) return null;

  return (
    <span
      className={styles.layer}
      aria-hidden="true"
      style={{
        "--study-pattern-image": `url("${pattern.image}")`,
        "--study-pattern-color": patternColor,
        "--study-pattern-size": pattern.size,
      }}
    />
  );
};

export const StudyPatternText = ({ active, backgroundColor, children }) => active ? (
  <span className={styles.textBadge} style={{ backgroundColor }}>
    {children}
  </span>
) : children;

export default StudyPatternLayer;
