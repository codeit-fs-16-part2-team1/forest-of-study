import { useEffect, useRef, useState } from "react";

const MAX_ROUTINES = 18;
const segmenter = new Intl.Segmenter("ko", { granularity: "grapheme" });
const nameErrorMessage = "습관 이름은 앞뒤 공백을 제외하고 1~20글자로 입력해주세요.";
const limitErrorMessage = "습관 입력칸은 최대 18개까지 추가할 수 있어요.";

const useRoutineEditor = ({ routines, onSubmit, onClose, onValidationError }) => {
  const originalRoutinesRef = useRef(routines);
  const nextDraftIdRef = useRef(1);
  const pendingFocusIdRef = useRef(null);
  const isSavingRef = useRef(false);
  const isMountedRef = useRef(true);
  const [draftRoutines, setDraftRoutines] = useState(() =>
    routines.length > 0
      ? routines.map((routine) => ({
          clientId: `routine-${routine.id}`,
          routineId: routine.id,
          name: routine.name,
        }))
      : [{ clientId: "new-0", routineId: null, name: "" }],
  );
  const [deletedRoutineIds, setDeletedRoutineIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const errors = Object.fromEntries(draftRoutines.map((routine) => [
    routine.clientId,
    Array.from(segmenter.segment(routine.name.trim())).length > 20
      ? `*${nameErrorMessage}`
      : "",
  ]));
  const hasErrors = Object.values(errors).some(Boolean);
  const hasName = draftRoutines.some((routine) => routine.name.trim() !== "");
  const canSubmit = typeof onSubmit === "function" &&
    (hasName || deletedRoutineIds.length > 0) && !isSaving;

  const createEmptyRoutine = () => {
    const clientId = `new-${nextDraftIdRef.current}`;
    nextDraftIdRef.current += 1;
    return { clientId, routineId: null, name: "" };
  };

  const canRemoveRoutine = (routine) =>
    !isSaving && (draftRoutines.length > 1 || routine.routineId !== null);

  const handleChangeRoutine = (clientId, name) => {
    if (isSavingRef.current) return;
    setDraftRoutines((previous) => previous.map((routine) =>
      routine.clientId === clientId ? { ...routine, name } : routine,
    ));
  };

  const handleAddRoutine = () => {
    if (isSavingRef.current) return;
    if (draftRoutines.length >= MAX_ROUTINES) {
      onValidationError?.(limitErrorMessage);
      return;
    }
    const routine = createEmptyRoutine();
    pendingFocusIdRef.current = routine.clientId;
    setDraftRoutines((previous) => previous.length >= MAX_ROUTINES
      ? previous
      : [...previous, routine]);
  };

  const handleRemoveRoutine = (clientId) => {
    if (isSavingRef.current) return;
    const index = draftRoutines.findIndex((routine) => routine.clientId === clientId);
    const routine = draftRoutines[index];
    if (!routine || !canRemoveRoutine(routine)) return;

    if (routine.routineId !== null) {
      setDeletedRoutineIds((previous) => previous.includes(routine.routineId)
        ? previous
        : [...previous, routine.routineId]);
    }
    const remaining = draftRoutines.filter((item) => item.clientId !== clientId);
    if (remaining.length === 0) remaining.push(createEmptyRoutine());
    pendingFocusIdRef.current = remaining[Math.min(index, remaining.length - 1)].clientId;
    setDraftRoutines(remaining);
  };

  const handleClose = () => {
    if (!isSavingRef.current) onClose?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || isSavingRef.current) return;
    if (hasErrors) {
      onValidationError?.(nameErrorMessage);
      return;
    }

    const originalNames = new Map(originalRoutinesRef.current.map((routine) =>
      [routine.id, routine.name],
    ));
    const creates = [];
    const updates = [];
    for (const routine of draftRoutines) {
      const name = routine.name.trim();
      // 빈 기존 항목은 이름을 유지하고, 빈 신규 항목은 생성하지 않는다.
      if (!name) continue;
      if (routine.routineId === null) creates.push({ name });
      else if (name !== originalNames.get(routine.routineId)) {
        updates.push({ routineId: routine.routineId, name });
      }
    }
    if (creates.length === 0 && updates.length === 0 && deletedRoutineIds.length === 0) {
      onClose?.();
      return;
    }

    // React가 버튼 disabled를 반영하기 전의 연속 제출·닫기도 막는다.
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const saved = await onSubmit({ creates, updates, endIds: deletedRoutineIds });
      if (saved && isMountedRef.current) onClose?.();
    } finally {
      isSavingRef.current = false;
      if (isMountedRef.current) setIsSaving(false);
    }
  };

  return {
    draftRoutines,
    pendingFocusIdRef,
    errors,
    isSaving,
    canSubmit,
    canAddRoutine: !isSaving,
    canRemoveRoutine,
    handleChangeRoutine,
    handleAddRoutine,
    handleRemoveRoutine,
    handleClose,
    handleSubmit,
  };
};

export default useRoutineEditor;
