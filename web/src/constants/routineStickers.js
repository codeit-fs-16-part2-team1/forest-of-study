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

// 색상 미지정 습관도 기본 발자국으로 표시한다.
export const getRoutineSticker = (stickerColor) =>
  routineStickers[(stickerColor ?? 1) - 1];
