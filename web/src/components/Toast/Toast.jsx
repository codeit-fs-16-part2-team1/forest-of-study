import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./Toast.module.scss";

const Toast = ({ toasts = [], className = "" }) => {
  const stackRef = useRef(null);

  useLayoutEffect(() => {
    const stack = stackRef.current;
    if (stack) stack.scrollTop = stack.scrollHeight;
  }, [toasts]);

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      ref={stackRef}
      className={[styles.stack, className].filter(Boolean).join(" ")}
    >
      {toasts.map(({ id, message, variant, isLeaving }) => {
        const isWarning = variant === "warning";

        return (
          <div
            key={id}
            className={[
              styles.toast,
              isWarning ? styles.warning : styles.point,
              isLeaving ? styles.leaving : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role={isWarning ? "alert" : "status"}
            aria-atomic="true"
          >
            <span aria-hidden="true">{isWarning ? "🚨" : "🎉"}</span>
            <p className={styles.message}>{message}</p>
          </div>
        );
      })}
    </div>,
    document.body,
  );
};

export default Toast;
