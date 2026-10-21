import { useEffect, useId, useRef, useState } from "react";
import studySortArrow from "../../assets/studySortArrow.svg";
import styles from "./StudySort.module.scss";

const sortOptions = [
  { value: "latest", label: "최근 순" },
  { value: "oldest", label: "오래된 순" },
  { value: "points_desc", label: "많은 포인트 순" },
  { value: "points_asc", label: "적은 포인트 순" },
];

const StudySort = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const initialFocusRef = useRef(0);
  const selectedIndex = sortOptions.findIndex((option) => option.value === value);
  const selectedOption = sortOptions[selectedIndex];

  useEffect(() => {
    if (!isOpen) return;

    optionRefs.current[initialFocusRef.current]?.focus();
    const handleOutsidePointer = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [isOpen]);

  const openMenu = (index = selectedIndex) => {
    initialFocusRef.current = index;
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (event) => {
    const index = optionRefs.current.indexOf(event.target);
    let nextIndex;
    if (event.key === "ArrowDown") nextIndex = (index + 1) % sortOptions.length;
    else if (event.key === "ArrowUp") nextIndex = (index - 1 + sortOptions.length) % sortOptions.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = sortOptions.length - 1;
    else return;

    event.preventDefault();
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      ref={containerRef}
      className={styles.sort}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          event.stopPropagation();
          closeMenu();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={`스터디 정렬: ${selectedOption.label}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => isOpen ? setIsOpen(false) : openMenu()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu(event.key === "ArrowUp" ? sortOptions.length - 1 : selectedIndex);
          }
        }}
      >
        <span>{selectedOption.label}</span>
        <span className={styles.arrow} aria-hidden="true">
          <img src={studySortArrow} alt="" />
        </span>
      </button>

      {isOpen && (
        <ul id={menuId} className={styles.menu} role="menu" aria-label="스터디 정렬" onKeyDown={handleMenuKeyDown}>
          {sortOptions.map((option, index) => (
            <li key={option.value} role="none">
              <button
                ref={(node) => { optionRefs.current[index] = node; }}
                type="button"
                className={styles.option}
                role="menuitemradio"
                aria-checked={option.value === value}
                tabIndex={-1}
                onClick={() => {
                  closeMenu();
                  if (option.value !== value) onChange(option.value);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default StudySort;
