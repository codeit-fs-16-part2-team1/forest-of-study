const graphemeSegmenter = new Intl.Segmenter("ko", {
  granularity: "grapheme",
});

// 조합 이모지와 결합 문자를 그래핌 단위로 센다.
export const countGraphemes = (value) => {
  return Array.from(graphemeSegmenter.segment(value)).length;
};
