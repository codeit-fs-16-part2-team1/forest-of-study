import { useState } from "react";
import { RxBookmark, RxBookmarkFilled } from "react-icons/rx";
import useBookmarkStudies from "../../hooks/useBookmarkStudies.js";
import { toggleBookmarkStudy } from "../../utils/bookmarkStudies.js";
import useToast from "../../hooks/useToast.js";
import Toast from "../Toast/Toast.jsx";
import Popup from "../Popup/Popup.jsx";

const BookmarkButton = ({ studyId, className = "", activeClassName = "", onShowToast, onRemoved }) => {
  const ids = useBookmarkStudies();
  const isBookmarked = ids.includes(studyId?.toLowerCase());
  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const { toasts, showToast: showLocalToast } = useToast();
  const showToast = onShowToast ?? showLocalToast;

  const handleToggle = (event) => {
    const button = event.currentTarget;
    const result = toggleBookmarkStudy(studyId);
    if (result === "removed") onRemoved?.(studyId, button);
    if (result === "limit") setIsLimitOpen(true);
    else if (result === "error") showToast("북마크를 저장하지 못했습니다. 다시 시도해주세요.", "warning");
    else showToast(result === "added" ? "북마크에 등록했습니다." : "북마크를 해제했습니다.");
  };

  return (
    <>
      <button
        type="button"
        data-bookmark-study-id={studyId}
        className={[className, isBookmarked ? activeClassName : ""].filter(Boolean).join(" ")}
        aria-label={isBookmarked ? "북마크 해제" : "북마크 등록"}
        aria-pressed={isBookmarked}
        onClick={handleToggle}
      >
        {isBookmarked ? <RxBookmarkFilled aria-hidden="true" /> : <RxBookmark aria-hidden="true" />}
      </button>
      {isLimitOpen && <Popup message="북마크는 3개만 등록할 수 있습니다" onClose={() => setIsLimitOpen(false)} />}
      <Toast toasts={toasts} />
    </>
  );
};

export default BookmarkButton;
