import { useCallback, useEffect, useId, useRef, useState } from "react";

const TOAST_DURATION = 3000;
const TOAST_EXIT_DURATION = 250; // Toast.module.scss의 opacity 전환 시간과 맞춘다.

const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const prefix = useId();
  const nextId = useRef(0);

  const dismissToast = useCallback((id) => {
    const removeAt = Date.now() + TOAST_EXIT_DURATION;
    setToasts((current) =>
      current.map((toast) =>
        toast.id === id && !toast.isLeaving ? { ...toast, isLeaving: true, removeAt } : toast,
      ),
    );
  }, []);

  const showToast = useCallback(
    (message, variant = "point") => {
      const id = prefix + "-" + nextId.current++;
      const expiresAt = Date.now() + TOAST_DURATION;
      setToasts((current) => [
        ...current,
        { id, message, variant, isLeaving: false, expiresAt },
      ]);
      return id;
    },
    [prefix],
  );

  useEffect(() => {
    // 종료 시각을 상태에 보관해 StrictMode의 cleanup 후 setup에서도 복원한다.
    const timers = toasts.map((toast) => window.setTimeout(() => {
      if (toast.isLeaving) {
        setToasts((current) => current.filter(({ id }) => id !== toast.id));
      } else {
        dismissToast(toast.id);
      }
    }, Math.max(0, (toast.isLeaving ? toast.removeAt : toast.expiresAt) - Date.now())));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts, dismissToast]);

  return { toasts, showToast, dismissToast };
};

export default useToast;
