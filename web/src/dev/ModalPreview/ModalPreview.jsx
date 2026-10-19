import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import Modal from "../../components/Modal/Modal.jsx";
import PasswordModal from "../../components/PasswordModal/PasswordModal.jsx";
import Popup from "../../components/Popup/Popup.jsx";
import Toast from "../../components/Toast/Toast.jsx";
import useToast from "../../hooks/useToast.js";
import styles from "./ModalPreview.module.scss";

const examples = [
  { key: "password", label: "비밀번호" },
  { key: "visible", label: "비밀번호 표시" },
  { key: "error", label: "오류 표시" },
  { key: "pending", label: "처리 중" },
  { key: "delete", label: "삭제용 비밀번호" },
  { key: "custom", label: "공통 모달 틀" },
  { key: "alert", label: "안내 팝업" },
  { key: "confirm", label: "확인 팝업" },
  { key: "point", label: "포인트 토스트" },
  { key: "warning", label: "경고 토스트" },
  { key: "stack", label: "토스트 5개 쌓기" },
];

const ModalPreview = () => {
  const [searchParams, setSearchParams] = useSearchParams();
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
    "delete",
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
      ["password", "visible", "error", "pending", "delete", "custom", "alert", "confirm"].includes(
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
          <Link className={styles.link} to="/dev/routes">
            라우트 테스트
          </Link>
        </div>
        <p className={styles.note}>
          토스트는 0.3초 간격으로 1~5번이 쌓입니다. 5번이 맨 아래이며 각각 표시
          후 3초 뒤 사라집니다.
        </p>
        <p className={styles.result} role="status">
          {result}
        </p>
      </main>
      {isPasswordExample && (
        <PasswordModal
          key={openedExample}
          title={openedExample === "delete" ? "스터디 삭제" : "연우의 개발공장"}
          submitLabel={openedExample === "delete" ? "삭제" : "제출"}
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
      {openedExample === "custom" && (
        <Modal
          title="공통 모달 틀 예시"
          description="비밀번호 입력형과 같은 틀에 다른 본문을 전달합니다."
          submitLabel="내용 제출"
          closeLabel="취소"
          onSubmit={() => closeDialog("공통 본문의 제출 콜백이 호출되었습니다.")}
          onClose={() => closeDialog("공통 모달을 닫았습니다.")}
        >
          <label className={styles.fieldLabel} htmlFor="custom-modal-message">
            메모 예시
          </label>
          <input
            id="custom-modal-message"
            className={styles.fieldInput}
            type="text"
            placeholder="원하는 본문을 넣을 수 있습니다."
            required
          />
        </Modal>
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

export default ModalPreview;
