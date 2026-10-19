import { Link, useLocation, useSearchParams } from "react-router";
import styles from "./RoutePreview.module.scss";

const RoutePreview = () => {
  const location = useLocation();
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

  return (
    <main className={styles.content}>
      <h1 className={styles.heading}>링크 라우트 확인</h1>
      <nav className={styles.controls} aria-label="개발 페이지 이동">
        <Link className={styles.link} to="/dev/modal">
          모달·팝업·토스트 미리보기
        </Link>
      </nav>
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
            <Link
              key={label}
              className={[styles.link, styles.routeLink].join(" ")}
              to={to}
              state={{
                from: location.pathname + location.search + location.hash,
              }}
            >
            <span>{label}</span>
            <code>{to}</code>
          </Link>
        ))}
      </nav>
    </main>
  );
};

export default RoutePreview;
