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