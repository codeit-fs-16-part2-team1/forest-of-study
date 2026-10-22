import useMinimumLoading from "../../hooks/useMinimumLoading.js";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import CurrentTime from "../../components/CurrentTime/CurrentTime.jsx";
import StudyPasswordVerification from "../../components/PasswordModal/StudyPasswordVerification.jsx";
import Popup from "../../components/Popup/Popup.jsx";
import RoutineModal from "../../components/RoutineModal/RoutineModal.jsx";
import RoutineList from "../../components/RoutineList/RoutineList.jsx";
import Toast from "../../components/Toast/Toast.jsx";
import useRoutines from "../../hooks/useRoutines.js";
import useStudyPassword from "../../hooks/useStudyPassword.js";
import useToast from "../../hooks/useToast.js";
import { getStudyReturnPath, goBackOrHome, isValidStudyId } from "../../utils/studyNavigation.js";
import styles from "./RoutinesPage.module.scss";

const RoutinesPage = ({ studyState }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studyId = searchParams.get("id");
  const { study, isLoading: isLoadingStudy, error: studyError, reloadStudy } = studyState;
  const isValidId = isValidStudyId(studyId);
  const [requestEntryError, setRequestEntryError] = useState("");
  const entryErrorMessage = !studyId
    ? "스터디 ID가 없습니다."
    : !isValidId || studyError?.status === 400
      ? "스터디 ID 형식이 올바르지 않습니다."
      : studyError?.status === 404
        ? studyError.message
        : requestEntryError;
  const currentPath = location.pathname + location.search + location.hash;
  const returnPath = getStudyReturnPath(location.state?.from, currentPath);
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const { toasts, showToast } = useToast();
  const goBack = useCallback(() => {
    navigate(returnPath, { replace: true });
  }, [navigate, returnPath]);

  const handleRequestError = useCallback((error) => {
    if (error.code === "STUDY_NOT_FOUND") setRequestEntryError(error.message);
    else showToast(error.message, "warning");
  }, [showToast]);

  const verification = useStudyPassword(isValidId ? studyId : null);
  const { verifiedPassword, requireVerification, isVerificationCurrent } = verification;

  useEffect(() => {
    if (verification.error) handleRequestError(verification.error);
  }, [verification.error, handleRequestError]);

  const handleRoutineError = useCallback((error) => {
    if (error.status === 401 || error.code === "STUDY_NOT_FOUND") {
      setIsRoutineModalOpen(false);
      requireVerification(error);
    }
    handleRequestError(error);
  }, [requireVerification, handleRequestError]);
  const handleDateRefreshed = useCallback(() => {
    showToast("날짜가 변경되어 오늘의 습관을 새로 불러왔어요.", "point");
  }, [showToast]);
  const {
    routineData,
    clock,
    isLoadingRoutines,
    routineError,
    pendingRoutineIds,
    reloadRoutines,
    saveRoutines,
    handleToggleRoutine,
  } = useRoutines(
    studyId, verifiedPassword, handleRoutineError, handleDateRefreshed, isVerificationCurrent,
  );

  const handleClosePasswordModal = () => {
    verification.close();
    goBackOrHome(navigate);
  };

  const handleSaveRoutines = async (changes) => {
    const saved = await saveRoutines(changes);
    if (saved) showToast("습관 목록을 저장했어요.", "point");
    return saved;
  };

  const showStudySkeleton = useMinimumLoading(isLoadingStudy, studyId);
  const showRoutineSkeleton = useMinimumLoading(
    verifiedPassword !== null && isLoadingRoutines, studyId,
  );
  const isLoading = !studyError && (showStudySkeleton || showRoutineSkeleton ||
    (verifiedPassword === null ? !verification.error : isLoadingRoutines));
  const showPageSkeleton = !studyError &&
    (isLoading || verification.isOpen || verification.isPending);
  const errorMessage = studyError?.message || verification.error?.message || routineError;

  if (entryErrorMessage) {
    return <Popup message={entryErrorMessage} onClose={goBack} />;
  }

  return (
    <>
      <main className={styles.main}>
        <div className={styles.container} aria-busy={showPageSkeleton}>
          {showPageSkeleton ? (
            <>
              <p className={styles.srOnly} role="status">습관 화면을 준비하고 있습니다.</p>
              <div className={styles.containerHeader} aria-hidden="true">
                <h2 className={styles.studyTitle}><span className={styles.skeletonTitle} /></h2>
                <nav><span className={styles.skeletonLink} /><span className={styles.skeletonLink} /></nav>
              </div>
              <div className={styles.currentTime} aria-hidden="true">
                <div className={styles.skeletonLabel} />
                <div className={styles.skeletonTime} />
              </div>
              <div className={styles.routineContainer}>
                <div className={styles.inner}>
                  <div className={styles.routineHeader} aria-hidden="true">
                    <div className={styles.skeletonSectionTitle} />
                    <div className={styles.skeletonEdit} />
                  </div>
                  <RoutineList isLoading />
                </div>
              </div>
            </>
          ) : (
                <>
              <div className={styles.containerHeader}>
                <h2 className={styles.studyTitle}>
                  {study ? (
                    <>
                      <span className={styles.nickname}>{study.nickname}</span>
                      의 {study.name}
                    </>
                  ) : "스터디"}
                </h2>
                <nav>
                  <Link to={`/challenge?id=${studyId}`} state={{ from: currentPath }}>오늘의 집중</Link>
                  <Link to={`/dashboard/${studyId}`} state={{ from: currentPath }}>스터디 상세</Link>
                </nav>
              </div>
              <CurrentTime
                clock={clock}
                isLoading={showRoutineSkeleton || !clock}
                skeletonClassName={styles.skeletonTime}
                className={styles.currentTime}
              />
              <div className={styles.routineContainer}>
                <div className={styles.inner}>
                  <div className={styles.routineHeader}>
                    <h3>오늘의 습관</h3>
                    <button
                      type="button"
                      onClick={() => setIsRoutineModalOpen(true)}
                      disabled={
                        isLoading || Boolean(errorMessage) || !routineData ||
                        pendingRoutineIds.length > 0
                      }
                    >
                      목록 수정
                    </button>
                  </div>
                  <RoutineList
                    routines={routineData?.routines}
                    isLoading={isLoading}
                    errorMessage={errorMessage}
                    errorTitle={studyError
                      ? "스터디 정보를 불러오지 못했어요"
                      : "습관을 불러오지 못했어요"}
                    pendingRoutineIds={pendingRoutineIds}
                    onRetry={studyError ? reloadStudy
                      : verifiedPassword === null ? verification.open : reloadRoutines}
                    onToggle={handleToggleRoutine}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      {Boolean(study) && !isLoadingStudy && !studyError && (
        <StudyPasswordVerification
          verification={verification}
          onClose={handleClosePasswordModal}
        />
      )}
      {verifiedPassword !== null && isRoutineModalOpen && routineData && (
        <RoutineModal
          routines={routineData.routines}
          onSubmit={handleSaveRoutines}
          onValidationError={(message) => showToast(message, "warning")}
          onClose={() => setIsRoutineModalOpen(false)}
        />
      )}
      <Toast toasts={toasts} />
    </>
  );
};

export default RoutinesPage;
