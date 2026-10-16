import { useCallback, useEffect, useId, useRef, useState } from "react";

const TOAST_DURATION = 3000;
const TOAST_EXIT_DURATION = 250; // Toast.module.scss의 opacity 전환 시간과 맞춘다.

const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const prefix = useId();
  const nextId = useRef(0);
  const timers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    const entry = timers.current.get(id);
    if (!entry || entry.isLeaving) return;

    window.clearTimeout(entry.timer);
    entry.isLeaving = true;
    setToasts((current) =>
      current.map((toast) =>
        toast.id === id ? { ...toast, isLeaving: true } : toast,
      ),
    );
    // 페이드 아웃이 끝난 뒤 목록에서 제거한다.
    entry.timer = window.setTimeout(() => {
      timers.current.delete(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_EXIT_DURATION);
  }, []);

  const showToast = useCallback(
    (message, variant = "point") => {
      const id = prefix + "-" + nextId.current++;
      setToasts((current) => [
        ...current,
        { id, message, variant, isLeaving: false },
      ]);
      timers.current.set(id, {
        timer: window.setTimeout(() => dismissToast(id), TOAST_DURATION),
        isLeaving: false,
      });
      return id;
    },
    [prefix, dismissToast],
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach((entry) => window.clearTimeout(entry.timer));
      activeTimers.clear();
    };
  }, []);

  return { toasts, showToast, dismissToast };
};

export default useToast;
