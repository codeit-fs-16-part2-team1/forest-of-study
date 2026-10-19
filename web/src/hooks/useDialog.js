import { useEffect, useRef } from "react";

// 동시에 열린 다이얼로그가 있어도 맨 위에서만 포커스를 제어한다.
const dialogs = [];
let previousOverflow = "";

const getFocusable = (dialog) =>
  Array.from(
    dialog.querySelectorAll(
      "a[href], button, input, select, textarea, [tabindex]",
    ),
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(":disabled") &&
      !element.closest("[hidden], [inert]") &&
      element.getClientRects().length > 0,
  );

const useDialog = (isOpen) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    const previousFocus = document.activeElement;
    if (dialogs.length === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    dialogs.push(dialog);

    const focusFirst = () =>
      (getFocusable(dialog)[0] || dialog).focus({ preventScroll: true });

    const handleKeyDown = (event) => {
      if (dialogs.at(-1) !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusable(dialog);
      const first = focusable[0];
      const last = focusable.at(-1);
      const active = document.activeElement;

      if (!first) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
      } else if (
        event.shiftKey &&
        (active === first || !focusable.includes(active))
      ) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (
        !event.shiftKey &&
        (active === last || !focusable.includes(active))
      ) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const handleFocusIn = (event) => {
      if (dialogs.at(-1) === dialog && !dialog.contains(event.target)) {
        focusFirst();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocusIn);
    focusFirst();

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocusIn);
      const wasTop = dialogs.at(-1) === dialog;
      const index = dialogs.lastIndexOf(dialog);
      if (index !== -1) dialogs.splice(index, 1);
      if (dialogs.length === 0) {
        document.body.style.overflow = previousOverflow;
      }
      if (wasTop) {
        const nextDialog = dialogs.at(-1);
        if (
          previousFocus?.isConnected &&
          (!nextDialog || nextDialog.contains(previousFocus))
        ) {
          previousFocus.focus?.({ preventScroll: true });
        } else if (nextDialog) {
          (getFocusable(nextDialog)[0] || nextDialog).focus({
            preventScroll: true,
          });
        }
      }
    };
  }, [isOpen]);

  return dialogRef;
};

export default useDialog;
