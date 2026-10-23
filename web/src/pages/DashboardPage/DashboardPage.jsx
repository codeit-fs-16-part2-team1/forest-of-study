import useMinimumLoading from "../../hooks/useMinimumLoading.js";
import { Link, useLocation, useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
import { studyApi } from "../../api/api.js";
import { getApiError } from "../../api/apiError.js";
import { isValidStudyPassword, studyPasswordMessages } from "../../utils/studyPassword.js";
import PasswordModal from "../../components/PasswordModal/PasswordModal.jsx";
import styles from "./DashboardPage.module.scss";
import RoutineHistoryTable from "../../components/RoutineHistoryTable/RoutineHistoryTable.jsx";
import StudyReactions from "../../components/StudyReactions/StudyReactions.jsx";
import Toast from "../../components/Toast/Toast.jsx";
import useToast from "../../hooks/useToast.js";
import studyPoint from "../../assets/studyPoint.svg";
import Popup from "../../components/Popup/Popup.jsx";
import { addBookmarkStudy, removeBookmarkStudy } from "../../utils/bookmarkStudies.js";
import BookmarkButton from "../../components/BookmarkButton/BookmarkButton.jsx";

const DashboardSkeleton = () => (
  <section className={styles.panel} aria-busy="true" aria-label="스터디 상세 불러오는 중">
    <p className={styles.srOnly} role="status">스터디를 불러오는 중입니다.</p>
    <div className={styles.toolbar} aria-hidden="true">
      <div className={styles.management}><span className={styles.skeletonManagement} /></div>
      <div className={styles.reactions}>
        <div className={styles.skeletonReactions}>
          {[0, 1, 2].map((index) => <span key={index} className={styles.skeletonReaction} />)}
        </div>
      </div>
    </div>
    <div className={styles.heading} aria-hidden="true">
      <div className={styles.skeletonTitle} />
      <div className={styles.links}><span className={styles.skeletonLink} /><span className={styles.skeletonLink} /></div>
    </div>
    <div className={styles.details} aria-hidden="true">
      <div><div className={styles.skeletonLabel} /><div className={styles.skeletonIntroduction} /></div>
      <div><div className={styles.skeletonLabel} /><div className={styles.skeletonPoints} /></div>
    </div>
    <div className={styles.skeletonHistory} aria-hidden="true" />
  </section>
);

const DashboardPage = ({ study, isLoading, error, onReactionsChange }) => {
  const showSkeleton = useMinimumLoading(isLoading);
  const location = useLocation();
  const navigate = useNavigate();
  const [bookmarkPromptId, setBookmarkPromptId] = useState(null);
  const [isBookmarkLimitOpen, setIsBookmarkLimitOpen] = useState(false);
  const consumedCreationRef = useRef(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const deleteRequestRef = useRef(null);
  const deleteFormVersionRef = useRef(0);
  const currentPath = location.pathname + location.search + location.hash;
  const { toasts, showToast } = useToast();

  useEffect(() => () => { deleteRequestRef.current = null; }, []);

  // 표시 상태는 메모리로 옮기고 이력에서 즉시 지워 새로고침·재방문 시 반복하지 않는다.
  useEffect(() => {
    if (!location.state?.createdStudyId || consumedCreationRef.current) return;
    consumedCreationRef.current = true;
    setBookmarkPromptId(location.state.createdStudyId);
    const remainingState = { ...location.state };
    delete remainingState.createdStudyId;
    navigate(currentPath, { replace: true, state: remainingState });
  }, [location.state, currentPath, navigate]);

  const confirmCreatedStudyBookmark = () => {
    if (bookmarkPromptId !== study?.id) return;
    const result = addBookmarkStudy(study.id);
    setBookmarkPromptId(null);
    if (result === "limit") setIsBookmarkLimitOpen(true);
    else if (result === "error") showToast("북마크를 저장하지 못했습니다. 다시 시도해주세요.", "warning");
    else showToast(result === "existing" ? "이미 북마크에 등록된 스터디입니다." : "북마크에 등록했습니다.");
  };

  const openDelete = () => {
    deleteFormVersionRef.current += 1;
    setDeleteError("");
    setIsDeleteOpen(true);
  };

  const closeDelete = () => {
    // 닫아도 이미 보낸 삭제 요청은 취소하지 않는다.
    deleteFormVersionRef.current += 1;
    setDeleteError("");
    setIsDeleteOpen(false);
  };

  const handleDelete = async (password) => {
    if (deleteRequestRef.current || !study?.id) return;
    if (!isValidStudyPassword(password)) {
      setDeleteError(studyPasswordMessages.invalid);
      return;
    }

    const request = Symbol("deleteStudy");
    const formVersion = deleteFormVersionRef.current;
    deleteRequestRef.current = request;
    setIsDeleting(true);
    setDeleteError("");

    try {
      await studyApi.remove(study.id, password);
      // 이탈 후에도 삭제된 ID는 정리하되 이전 페이지의 UI는 갱신하지 않는다.
      removeBookmarkStudy(study.id);
      if (deleteRequestRef.current !== request) return;

      setIsDeleteOpen(false);
      navigate("/studies", { replace: true, state: { studyDeleted: true } });
    } catch (error) {
      if (deleteRequestRef.current === request && deleteFormVersionRef.current === formVersion) {
        // 비밀번호가 포함될 수 있는 Axios 오류 전체 대신 표시 문구만 보관한다.
        setDeleteError(getApiError(error).message);
      }
    } finally {
      if (deleteRequestRef.current === request) {
        deleteRequestRef.current = null;
        setIsDeleting(false);
      }
    }
  };

  const handleShare = async () => {
    if (!study?.id) return;

    // 공개 상세 주소만 복사한다. 현재 URL의 쿼리나 해시는 포함하지 않는다.
    const shareUrl = new URL(`/dashboard/${study.id}`, window.location.origin).href;

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("링크를 복사했습니다.", "point");
    } catch {
      // 클립보드 미지원·권한 거절도 같은 실패 안내를 사용한다.
      showToast("링크를 복사하지 못했습니다. 다시 시도해주세요.", "warning");
    }
  };

  if (showSkeleton) {
    return <main className={styles.page}><DashboardSkeleton /></main>;
  }

  if (error) {
    return (
      <main className={styles.page}>
        <section className={`${styles.panel} ${styles.status}`}>
          <h1 className={styles.title}>
            {error.status === 404
              ? "스터디를 찾을 수 없어요"
              : "스터디를 불러오지 못했어요"}
          </h1>

          <p role="alert">{error.message}</p>
          <Link to="/" className={styles.homeLink}>
            홈으로 이동
          </Link>
        </section>
      </main>
    );
  }

  if (!study) return null;

  return (
    <main className={styles.page}>
      {isDeleteOpen && <DashboardSkeleton />}
      <section className={styles.panel} aria-labelledby="study-title" hidden={isDeleteOpen}>
        <div className={styles.toolbar}>
          <nav className={styles.management} aria-label="스터디 관리">
            <button type="button" onClick={handleShare}>
              공유하기
            </button>
            <span className={styles.managementDivider} aria-hidden="true">|</span>
            <Link to={`/reg?id=${study.id}`}>수정하기</Link>
            <span className={styles.managementDivider} aria-hidden="true">|</span>
            <button type="button" className={styles.deleteButton} onClick={openDelete}>
              스터디 삭제하기
            </button>
          </nav>
          <div className={styles.reactions}>
            <StudyReactions
              studyId={study.id}
              reactions={study.reactions ?? []}
              onReactionsChange={onReactionsChange}
              onShowToast={showToast}
            />
          </div>
        </div>

        <div className={styles.heading}>
          <div className={styles.titleGroup}>
            <BookmarkButton
              onShowToast={showToast}
              studyId={study.id}
              className={styles.bookmarkButton}
              activeClassName={styles.isBookmarked}
            />
            <h1 id="study-title" className={styles.title}>
              <span className={styles.nickname}>{study.nickname}</span>
              의 {study.name}
            </h1>
          </div>

          <nav className={styles.links} aria-label="스터디 활동">
            <Link to={`/routines?id=${study.id}`} state={{ from: currentPath }}>
              오늘의 습관
            </Link>

            <Link to={`/challenge?id=${study.id}`}>
              오늘의 집중
            </Link>
          </nav>
        </div>

        <dl className={styles.details}>
          <div>
            <dt>소개</dt>
            <dd className={styles.introduction}>
              {study.introduction}
            </dd>
          </div>

          <div>
            <dt>현재까지 획득한 포인트</dt>
            <dd className={styles.points}>
              <span className={styles.pointIcon} aria-hidden="true">
                <img src={studyPoint} alt="" />
              </span>
              {study.points.toLocaleString("ko-KR")}P 획득
            </dd>
          </div>
        </dl>
        <RoutineHistoryTable
          key={study.id}
          studyId={study.id}
        />
      </section>
      {isDeleteOpen && (
        <PasswordModal
          title="스터디 삭제"
          className={styles.deleteModal}
          closeLabel="취소"
          submitLabel={isDeleting ? "삭제 중..." : "삭제하기"}
          isPending={isDeleting}
          errorMessage={deleteError}
          onSubmit={handleDelete}
          onClose={closeDelete}
        />
      )}
      {bookmarkPromptId === study.id && (
        <Popup
          mode="confirm"
          message="스터디 등록에 성공했습니다! 북마크에 등록할까요?"
          cancelLabel="아니오"
          confirmLabel="예"
          onClose={() => setBookmarkPromptId(null)}
          onConfirm={confirmCreatedStudyBookmark}
        />
      )}
      {isBookmarkLimitOpen && (
        <Popup
          message="북마크는 3개만 등록할 수 있습니다"
          onClose={() => setIsBookmarkLimitOpen(false)}
        />
      )}
      <Toast toasts={toasts} />
    </main>
  );
};

export default DashboardPage;
