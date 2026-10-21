-- 기존 습관과 기록은 보존한다. null은 기존 목록 순서에 따른 표시를 뜻한다.
ALTER TABLE "Routine" ADD COLUMN "stickerColor" INTEGER;
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_sticker_color_range"
  CHECK ("stickerColor" IS NULL OR "stickerColor" BETWEEN 1 AND 18);
