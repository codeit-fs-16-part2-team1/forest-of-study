import seeds from "../assets/patterns/seeds.svg";
import ripples from "../assets/patterns/ripples.svg";
import gingham from "../assets/patterns/gingham.svg";
import leaves from "../assets/patterns/leaves.svg";
import paper from "../assets/patterns/paper.svg";

// 기존 스터디를 그대로 표시·수정할 수 있도록 첫 3종의 저장 키는 유지한다.
export const studyPatterns = [
  { key: "dots", label: "씨앗", image: seeds, size: "96px 96px" },
  { key: "waves", label: "잔물결", image: ripples, size: "160px 64px" },
  { key: "stripes", label: "소프트 체크", image: gingham, size: "64px 64px" },
  { key: "leaves", label: "작은 잎", image: leaves, size: "112px 112px" },
  { key: "paper", label: "페이퍼", image: paper, size: "96px 96px" },
];
