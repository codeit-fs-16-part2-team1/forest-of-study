const stickerFiles = import.meta.glob(
  "../assets/routine-stickers/*.png",
  {
    eager: true,
    query: "?url",
    import: "default",
  }
);

export const emptySticker =
  stickerFiles["../assets/routine-stickers/sticker-empty.png"];

export const routineStickers = Array.from(
  { length: 18 },
  (_, index) => {
    const number = String(index + 1).padStart(2, "0");

    return stickerFiles[
      `../assets/routine-stickers/sticker-${number}.png`
    ];
  }
);

// null은 선택 기능 도입 전에 만든 습관이다. 기존 표시 순서만 이 경우에 사용한다.
export const getRoutineSticker = (stickerColor, rowIndex = 0) =>
  routineStickers[stickerColor == null
    ? rowIndex % routineStickers.length
    : stickerColor - 1];
