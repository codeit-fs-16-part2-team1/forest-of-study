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

// 기존 null 색상만 표시 행 순서로 순환한다. 신규 습관은 편집 상태에 1을 저장한다.
export const getRoutineStickerColor = (stickerColor, rowIndex = 0) =>
  stickerColor ?? (rowIndex % routineStickers.length) + 1;

export const getRoutineSticker = (stickerColor, rowIndex = 0) =>
  routineStickers[getRoutineStickerColor(stickerColor, rowIndex) - 1];
