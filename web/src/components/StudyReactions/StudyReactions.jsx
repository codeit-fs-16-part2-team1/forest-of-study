import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import useStudyReactions from "../../hooks/useStudyReactions.js";
import useToast from "../../hooks/useToast.js";
import Toast from "../Toast/Toast.jsx";
import smile from "../../assets/reaction/smile.svg";
import plus from "../../assets/reaction/plus.svg";
import styles from "./StudyReactions.module.scss";

const desktopQuery = "(min-width: 1024px)";

const ReactionBadges = ({ reactions, label }) => (
  <ul className={styles.list} aria-label={label}>
    {reactions.map(({ emoji, count }) => (
      <li key={emoji} className={styles.badge}>
        <span className={styles.emoji} role="img" aria-label={emoji}>{emoji}</span>
        <span aria-label={`${count}개`}>{count}</span>
      </li>
    ))}
  </ul>
);

const StudyReactionsContent = ({
  studyId,
  reactions = [],
  isLoading = false,
  onReactionsChange,
  onShowToast,
}) => {
  const id = useId();
  // 열린 순서를 보관해 좁은 화면으로 바뀌면 마지막으로 연 창만 남긴다.
  const [openPopovers, setOpenPopovers] = useState([]);
  const [popoverOffsets, setPopoverOffsets] = useState({ more: 0, picker: 0 });
  const toolbarRef = useRef(null);
  const summaryRef = useRef(null);
  const moreAnchorRef = useRef(null);
  const pickerAnchorRef = useRef(null);
  const morePopoverRef = useRef(null);
  const pickerPopoverRef = useRef(null);
  const { toasts, showToast: showLocalToast } = useToast();
  // 상세에서는 공유 알림과 같은 목록을 쓰고, 독립 미리보기에서는 자체 표시한다.
  const showToast = onShowToast ?? showLocalToast;
  const { isPending, error, addReaction } = useStudyReactions({ studyId, onReactionsChange });
  const isDuplicateError = error?.code === "REACTION_POLICY_CONFLICT";
  const disabled = isLoading || isPending || !studyId
    || typeof onReactionsChange !== "function";
  const topReactions = reactions.slice(0, 3);
  const remainingReactions = reactions.slice(3);
  const isPickerOpen = openPopovers.includes("picker");
  const isMoreOpen = openPopovers.includes("more") && remainingReactions.length > 0;
  const hasOpenPopover = isPickerOpen || isMoreOpen;

  useEffect(() => {
    if (error?.code === "REACTION_POLICY_CONFLICT") {
      showToast(error.message, "warning");
    }
  }, [error, showToast]);

  const togglePopover = (type) => {
    const isDesktop = window.matchMedia(desktopQuery).matches;
    setOpenPopovers((previous) => {
      if (previous.includes(type)) return previous.filter((open) => open !== type);
      return isDesktop ? [...previous, type] : [type];
    });
  };

  useEffect(() => {
    const media = window.matchMedia(desktopQuery);
    const handleChange = (event) => {
      if (!event.matches) {
        setOpenPopovers((previous) => previous.length > 1 ? previous.slice(-1) : previous);
      }
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!hasOpenPopover) return;

    const closeOutside = (event) => {
      // PC에서는 다른 응원 창 안의 클릭으로 이미 열린 창을 닫지 않는다.
      if (!moreAnchorRef.current?.contains(event.target)
        && !pickerAnchorRef.current?.contains(event.target)) {
        setOpenPopovers([]);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [hasOpenPopover]);

  useLayoutEffect(() => {
    const popovers = [
      { type: "more", isOpen: isMoreOpen, anchor: moreAnchorRef.current, panel: morePopoverRef.current },
      { type: "picker", isOpen: isPickerOpen, anchor: pickerAnchorRef.current, panel: pickerPopoverRef.current },
    ].filter(({ isOpen, anchor, panel }) => isOpen && anchor && panel);
    if (popovers.length === 0) return;

    const alignPopovers = () => {
      const offsets = { more: 0, picker: 0 };
      const viewportWidth = document.documentElement.clientWidth;
      for (const { type, anchor, panel } of popovers) {
        const anchorLeft = anchor.getBoundingClientRect().left;
        // 하나만 열렸을 때는 각 버튼의 기준 위치에 맞춘다.
        const isMore = type === "more";
        const summaryLeft = summaryRef.current?.getBoundingClientRect().left ?? anchorLeft;
        const preferredLeft = isMore ? summaryLeft - 18 : anchorLeft;
        const viewportPadding = isMore ? 8 : 16;
        const maxLeft = Math.max(viewportPadding, viewportWidth - viewportPadding - panel.offsetWidth);
        const left = Math.min(Math.max(preferredLeft, viewportPadding), maxLeft);
        offsets[type] = left - anchorLeft;
      }

      if (popovers.length === 2 && window.matchMedia(desktopQuery).matches) {
        const more = popovers.find(({ type }) => type === "more");
        const picker = popovers.find(({ type }) => type === "picker");
        // 버튼 사이의 CSS 간격을 두 창 사이에도 그대로 사용한다.
        const gap = Number.parseFloat(window.getComputedStyle(toolbarRef.current).columnGap);
        const moreAnchorLeft = more.anchor.getBoundingClientRect().left;
        const pickerAnchorLeft = picker.anchor.getBoundingClientRect().left;
        const totalWidth = more.panel.offsetWidth + gap + picker.panel.offsetWidth;
        const maxLeft = Math.max(8, viewportWidth - 16 - totalWidth);
        const left = Math.min(Math.max(moreAnchorLeft + offsets.more, 8), maxLeft);

        offsets.more = left - moreAnchorLeft;
        offsets.picker = left + more.panel.offsetWidth + gap - pickerAnchorLeft;
      }
      setPopoverOffsets((previous) =>
        previous.more === offsets.more && previous.picker === offsets.picker ? previous : offsets);
    };

    alignPopovers();
    const observer = new ResizeObserver(alignPopovers);
    for (const { anchor, panel } of popovers) {
      observer.observe(anchor);
      observer.observe(panel);
    }
    if (summaryRef.current) observer.observe(summaryRef.current);
    window.addEventListener("resize", alignPopovers);
    window.addEventListener("scroll", alignPopovers, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", alignPopovers);
      window.removeEventListener("scroll", alignPopovers, true);
    };
  }, [isMoreOpen, isPickerOpen, remainingReactions.length]);

  const handleEmojiClick = async (emojiData) => {
    if (disabled) return;

    if (await addReaction(emojiData.emoji)) {
      showToast("응원을 보냈습니다.", "point");
      setOpenPopovers((previous) => previous.filter((open) => open !== "picker"));
    }
  };

  return (
    <section className={styles.reactions} aria-labelledby={`${id}-heading`} aria-busy={isLoading || isPending}>
      <h2 id={`${id}-heading`} className={styles.srOnly}>응원</h2>
      <div className={styles.toolbar} ref={toolbarRef}>
        {isLoading ? (
          <div className={styles.skeletons} role="status" aria-label="응원 불러오는 중">
            {[0, 1, 2].map((index) => <span key={index} className={styles.skeleton} />)}
          </div>
        ) : reactions.length === 0 ? (
          <p className={styles.empty}>아직 응원이 없습니다.</p>
        ) : (
          <div className={styles.summary} ref={summaryRef}>
            <ReactionBadges reactions={topReactions} label="상위 응원 이모지" />
            {remainingReactions.length > 0 && (
              <div className={styles.anchor} ref={moreAnchorRef}>
                <button
                  type="button"
                  className={`${styles.badge} ${styles.moreButton}`}
                  aria-expanded={isMoreOpen}
                  aria-controls={`${id}-more`}
                  aria-label={`나머지 응원 ${remainingReactions.length}종 ${isMoreOpen ? "닫기" : "보기"}`}
                  disabled={isPending}
                  onClick={() => togglePopover("more")}
                >
                  <img src={plus} alt="" />
                  {remainingReactions.length}..
                </button>
                {isMoreOpen && (
                  <div
                    ref={morePopoverRef}
                    id={`${id}-more`}
                    className={`${styles.popover} ${styles.morePopover}`}
                    style={{ "--popover-offset": `${popoverOffsets.more}px` }}
                    role="region"
                    aria-label="나머지 응원 목록"
                  >
                    <ReactionBadges reactions={remainingReactions} label="나머지 응원 이모지" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className={styles.anchor} ref={pickerAnchorRef}>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={isPickerOpen}
            aria-controls={`${id}-picker`}
            aria-label={isPickerOpen ? "응원 이모지 선택기 닫기" : "응원 이모지 추가"}
            disabled={disabled}
            onClick={() => togglePopover("picker")}
          >
            <img src={smile} alt="" />
            {isPickerOpen ? "닫기" : "추가"}
          </button>
          {isPickerOpen && (
            <div
              ref={pickerPopoverRef}
              id={`${id}-picker`}
              className={`${styles.popover} ${styles.picker}`}
              style={{ "--popover-offset": `${popoverOffsets.picker}px` }}
              role="region"
              aria-label="응원 이모지 선택"
            >
              <fieldset disabled={disabled}>
                <legend className={styles.srOnly}>등록할 이모지 선택</legend>
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </fieldset>
            </div>
          )}
        </div>
      </div>

      <p className={styles.srOnly} role="status">
        {isPending ? "응원을 보내는 중입니다." : ""}
      </p>
      {error && !isDuplicateError && <p className={styles.error} role="alert">{error.message}</p>}
      {!onShowToast && <Toast toasts={toasts} />}
    </section>
  );
};

// 스터디가 바뀌면 선택기·메시지·이전 요청 문맥도 함께 새로 만든다.
const StudyReactions = (props) => (
  <StudyReactionsContent key={props.studyId ?? "missing"} {...props} />
);

export default StudyReactions;
