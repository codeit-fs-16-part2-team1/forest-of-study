import { useEffect, useId, useRef, useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import SortableRoutineRow from "./SortableRoutineRow.jsx";
import { createPortal } from "react-dom";
import useDialog from "../../hooks/useDialog.js";
import useRoutineEditor from "../../hooks/useRoutineEditor.js";
import RoutineColorModal from "./RoutineColorModal.jsx";
import { getRoutineSticker } from "../../constants/routineStickers.js";
import styles from "./RoutineModal.module.scss";

const RoutineModal = ({
  isOpen = true,
  routines = [],
  onSubmit,
  onClose,
  onValidationError,
}) => {
  const id = useId();
  const [isDragging, setIsDragging] = useState(false);
  const dialogRef = useDialog(isOpen, isDragging);
  const [colorRoutineId, setColorRoutineId] = useState(null);
  const colorTriggerRef = useRef(null);

  useEffect(() => {
    if (colorRoutineId !== null || !colorTriggerRef.current) return;
    colorTriggerRef.current.focus({ preventScroll: true });
    colorTriggerRef.current = null;
  }, [colorRoutineId]);
  const [moveMessage, setMoveMessage] = useState("");
  const routineListRef = useRef(null);
  const routineRowsRef = useRef(null);
  const {
    draftRoutines,
    pendingFocusIdRef,
    errors,
    isSaving,
    canSubmit,
    canAddRoutine,
    canRemoveRoutine,
    handleChangeRoutine,
    handleChangeColor,
    handleMoveRoutine,
    handleAddRoutine,
    handleRemoveRoutine,
    handleClose,
    handleSubmit,
  } = useRoutineEditor({ routines, onSubmit, onClose, onValidationError });
  const [scrollEdges, setScrollEdges] = useState({
    hasMoreAbove: false,
    hasMoreBelow: false,
  });

  useEffect(() => {
    if (!isOpen || pendingFocusIdRef.current === null) return;

    document.getElementById(`${id}-${pendingFocusIdRef.current}`)?.focus();
    pendingFocusIdRef.current = null;
  }, [draftRoutines, id, isOpen, pendingFocusIdRef]);

  useEffect(() => {
    if (!isOpen) return;

    const routineList = routineListRef.current;
    const routineRows = routineRowsRef.current;
    if (!routineList || !routineRows) return;

    const updateScrollEdges = () => {
      const maxScrollTop = Math.max(
        0,
        routineList.scrollHeight - routineList.clientHeight,
      );
      const scrollTop = Math.max(
        0,
        Math.min(routineList.scrollTop, maxScrollTop),
      );
      const isScrollable = routineList.clientHeight > 0 && maxScrollTop > 1;
      // 스크롤 위치의 소수점 오차는 1px까지 허용합니다.
      const nextEdges = {
        hasMoreAbove: isScrollable && scrollTop > 1,
        hasMoreBelow: isScrollable && maxScrollTop - scrollTop > 1,
      };

      setScrollEdges((previous) =>
        previous.hasMoreAbove === nextEdges.hasMoreAbove &&
        previous.hasMoreBelow === nextEdges.hasMoreBelow
          ? previous
          : nextEdges,
      );
    };

    updateScrollEdges();
    routineList.addEventListener("scroll", updateScrollEdges, { passive: true });
    window.addEventListener("resize", updateScrollEdges);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateScrollEdges);
    resizeObserver?.observe(routineList);
    resizeObserver?.observe(routineRows);

    return () => {
      routineList.removeEventListener("scroll", updateScrollEdges);
      window.removeEventListener("resize", updateScrollEdges);
      resizeObserver?.disconnect();
    };
  }, [isOpen]);

  const colorRoutine = draftRoutines.find((routine) => routine.clientId === colorRoutineId);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        className={styles.backdrop}
        onClick={(event) => {
          if (event.target === event.currentTarget && !isDragging) handleClose();
        }}
      >
        <section
          ref={dialogRef}
          className={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby={id + "-title"}
          aria-busy={isSaving}
          inert={Boolean(colorRoutine)}
          tabIndex={-1}
        >
          <h2 id={id + "-title"} className={styles.title}>
            습관 목록
          </h2>
          <form className={styles.form} onSubmit={(event) => {
            if (isDragging) event.preventDefault();
            else handleSubmit(event);
          }}>
            <p className={styles.srOnly} role="status">{moveMessage}</p>
            <DragDropProvider
              onDragStart={() => setIsDragging(true)}
              onDragEnd={(event) => {
                setIsDragging(false);
                const { source } = event.operation;
                if (event.canceled || !isSortable(source)) return;
                handleMoveRoutine(source.initialIndex, source.index);
                setMoveMessage(`습관을 ${source.index + 1}번째로 이동했어요.`);
              }}
            >
              <div className={styles.routineEditor}>
                <div
                  className={[
                    styles.scrollViewport,
                    scrollEdges.hasMoreAbove && styles.hasMoreAbove,
                    scrollEdges.hasMoreBelow && styles.hasMoreBelow,
                  ].filter(Boolean).join(" ")}
                >
                  <div ref={routineListRef} className={styles.routineList}>
                    <div ref={routineRowsRef} className={styles.routineRows}>
                      {draftRoutines.map((routine, index) => (
                        <SortableRoutineRow
                          key={routine.clientId}
                          routine={routine}
                          index={index}
                          disabled={isSaving || Boolean(colorRoutine)}
                        >
                          <button
                            type="button"
                            className={styles.colorButton}
                            onClick={(event) => {
                              colorTriggerRef.current = event.currentTarget;
                              setColorRoutineId(routine.clientId);
                            }}
                            aria-label={`${routine.name || `${index + 1}번째 습관`} 색상 선택, 현재 ${routine.stickerColor}번`}
                            aria-haspopup="dialog"
                            disabled={isSaving || isDragging}
                          >
                            <img src={getRoutineSticker(routine.stickerColor)} width="32" height="32" alt="" />
                          </button>
                          <div className={styles.routineField}>
                            <input
                              id={`${id}-${routine.clientId}`}
                              className={styles.routineInput}
                              type="text"
                              value={routine.name}
                              onChange={(event) =>
                                handleChangeRoutine(routine.clientId, event.target.value)
                              }
                              placeholder="습관을 입력해주세요"
                              aria-label={`${index + 1}번째 습관 이름`}
                              aria-invalid={Boolean(errors[routine.clientId])}
                              aria-describedby={
                                errors[routine.clientId]
                                  ? `${id}-${routine.clientId}-error`
                                  : undefined
                              }
                              disabled={isSaving}
                            />
                            {errors[routine.clientId] && (
                              <p
                                id={`${id}-${routine.clientId}-error`}
                                className={styles.inputError}
                                aria-live="polite"
                              >
                                {errors[routine.clientId]}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            className={styles.deleteButton}
                            onClick={() => handleRemoveRoutine(routine.clientId)}
                            aria-label={`${routine.name || `${index + 1}번째 습관`} 삭제`}
                            disabled={!canRemoveRoutine(routine) || isDragging}
                          >
                            삭제
                          </button>
                        </SortableRoutineRow>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.addRoutineButton}
                  onClick={handleAddRoutine}
                  disabled={!canAddRoutine || isDragging}
                >
                  습관 추가
                </button>
              </div>
            </DragDropProvider>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleClose}
                disabled={isSaving || isDragging}
              >
                취소
              </button>
              <button
                type="submit"
                className={[styles.actionButton, styles.submitButton].join(" ")}
                disabled={!canSubmit || isDragging}
              >
                {isSaving ? "저장 중…" : "수정 완료"}
              </button>
            </div>
          </form>
        </section>
      </div>
      {colorRoutine && (
        <RoutineColorModal
          stickerColor={colorRoutine.stickerColor}
          isSaving={isSaving}
          onSelect={(stickerColor) => {
            if (isSaving) return;
            handleChangeColor(colorRoutine.clientId, stickerColor);
            setColorRoutineId(null);
          }}
          onClose={() => { if (!isSaving) setColorRoutineId(null); }}
        />
      )}
    </>,
    document.body,
  );
};

export default RoutineModal;
