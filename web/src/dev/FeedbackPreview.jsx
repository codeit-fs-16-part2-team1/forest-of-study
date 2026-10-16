import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import Modal from "../components/Modal/Modal.jsx";
import Popup from "../components/Popup/Popup.jsx";
import Toast from "../components/Toast/Toast.jsx";
import useToast from "../hooks/useToast.js";
import styles from "./FeedbackPreview.module.scss";

const examples = [
  { key: "password", label: "비밀번호" },
  { key: "visible", label: "비밀번호 표시" },
  { key: "error", label: "오류 표시" },
  { key: "pending", label: "처리 중" },
  { key: "alert", label: "안내 팝업" },
  { key: "confirm", label: "확인 팝업" },
  { key: "point", label: "포인트 토스트" },
  { key: "warning", label: "경고 토스트" },
  { key: "stack", label: "토스트 5개 쌓기" },
];

const FeedbackPreview = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const studyId =
    searchParams.get("studyId") ?? "10000000-0000-4000-8000-000000000001";
  const studyQuery = new URLSearchParams({ id: studyId }).toString();
  const routeLinks = [
    { label: "홈", to: "/" },
    { label: "스터디 등록", to: "/reg" },
    { label: "스터디 상세", to: "/dashboard/" + encodeURIComponent(studyId) },
    { label: "오늘의 습관", to: "/routines?" + studyQuery },
    { label: "오늘의 집중", to: "/challenge?" + studyQuery },
    { label: "스터디 수정", to: "/reg?" + studyQuery },
    { label: "없는 주소 (404)", to: "/dev/route-not-found" },
  ];
  const requestedExample = searchParams.get("example");
  const example = examples.some(({ key }) => key === requestedExample)
    ? requestedExample
    : "password";
  const [openedExample, setOpenedExample] = useState(null);
  const [result, setResult] = useState("");
  const { toasts, showToast } = useToast();
  const demoTimers = useRef(new Set());
  const isPasswordExample = [
    "password",
    "visible",
    "error",
    "pending",
  ].includes(openedExample);

  useEffect(() => {
    const timers = demoTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const clearDemoTimers = () => {
    demoTimers.current.forEach((timer) => window.clearTimeout(timer));
    demoTimers.current.clear();
  };

  const playStack = () => {
    clearDemoTimers();
    showToast("1번 메시지: 토스트 쌓기 예시", "point");
    for (let index = 1; index < 5; index += 1) {
      const timer = window.setTimeout(() => {
        demoTimers.current.delete(timer);
        showToast(
          index + 1 + "번 메시지: 토스트 쌓기 예시",
          index % 2 === 0 ? "point" : "warning",
        );
      }, index * 300);
      demoTimers.current.add(timer);
    }
  };

  const runExample = (key) => {
    clearDemoTimers();
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("example", key);
      return next;
    });
    setResult("");
    if (
      ["password", "visible", "error", "pending", "alert", "confirm"].includes(
        key,
      )
    ) {
      setOpenedExample(key);
    } else {
      setOpenedExample(null);
      if (key === "stack") {
        playStack();
      } else if (key === "warning") {
        showToast("경고 토스트 예시입니다.", "warning");
      } else {
        showToast("포인트 토스트 예시입니다.", "point");
      }
    }
  };

  const closeDialog = (message) => {
    setOpenedExample(null);
    setResult(message);
  };

  return (
    <div className={styles.preview}>
      <nav className={styles.navigation} aria-label="공통 UI 예시 선택">
        {examples.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={styles.link}
            aria-pressed={example === key}
            onClick={() => runExample(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <main className={styles.content}>
        <h1 className={styles.heading}>공통 컴포넌트 동작 확인</h1>
        <p className={styles.note}>
          위 메뉴를 누르면 예시가 실행됩니다. API 요청과 실제 인증·포인트 지급은
          없습니다.
        </p>
        <div className={styles.controls}>
          <button
            className={styles.link}
            type="button"
            onClick={() => runExample(example)}
          >
            선택한 예시 다시 실행
          </button>
          <button
            className={styles.link}
            type="button"
            onClick={() => runExample("stack")}
          >
            토스트 5개 쌓기
          </button>
        </div>
        <p className={styles.note}>
          토스트는 0.3초 간격으로 1~5번이 쌓입니다. 5번이 맨 아래이며 각각 표시
          후 3초 뒤 사라집니다.
        </p>
        <section className={styles.routes} aria-labelledby="route-preview-heading">
          <h2 id="route-preview-heading" className={styles.routeHeading}>
            링크 라우트 확인
          </h2>
          <label className={styles.routeLabel} htmlFor="route-study-id">
            스터디 ID
          </label>
          <input
            id="route-study-id"
            className={styles.routeInput}
            type="text"
            value={studyId}
            autoComplete="off"
            onChange={(event) => {
              const value = event.target.value;
              setSearchParams((current) => {
                const next = new URLSearchParams(current);
                next.set("studyId", value);
                return next;
              }, { replace: true });
            }}
          />
          <p className={styles.note}>
            링크를 누르면 해당 페이지로 이동합니다. 브라우저 뒤로 가기로
            돌아올 수 있습니다.
          </p>
          <nav className={styles.routeLinks} aria-label="페이지 라우트 테스트">
            {routeLinks.map(({ label, to }) => (
              <Link key={label} className={[styles.link, styles.routeLink].join(" ")} to={to}>
                <span>{label}</span>
                <code>{to}</code>
              </Link>
            ))}
          </nav>
        </section>
        <p className={styles.result} role="status">
          {result}
        </p>
      </main>
      {isPasswordExample && (
        <Modal
          key={openedExample}
          title="연우의 개발공장"
          submitLabel="제출"
          defaultPasswordVisible={openedExample === "visible"}
          errorMessage={openedExample === "error" ? "오류 안내 문구 예시" : ""}
          isPending={openedExample === "pending"}
          onSubmit={() =>
            closeDialog(
              "제출 콜백이 호출되었습니다. API 검증은 하지 않았습니다.",
            )
          }
          onClose={() => closeDialog("비밀번호 모달을 닫았습니다.")}
        />
      )}
      {(openedExample === "alert" || openedExample === "confirm") && (
        <Popup
          key={openedExample}
          mode={openedExample}
          message={
            openedExample === "confirm"
              ? "확인 또는 취소를 선택해 주세요."
              : "안내 팝업 예시입니다."
          }
          onConfirm={() => closeDialog("확인을 선택했습니다.")}
          onCancel={() => closeDialog("취소를 선택했습니다.")}
          onClose={() => closeDialog("배경을 눌러 안내 팝업을 닫았습니다.")}
        />
      )}
      <Toast toasts={toasts} />
    </div>
  );
};

export default FeedbackPreview;
