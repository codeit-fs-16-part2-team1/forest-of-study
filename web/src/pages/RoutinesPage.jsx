import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import CurrentTime from "../components/CurrentTime/CurrentTime.jsx";
import PasswordModal from "../components/PasswordModal/PasswordModal.jsx";
import Popup from "../components/Popup/Popup.jsx";
import RoutineModal from "../components/RoutineModal/RoutineModal.jsx";
import RoutineList from "../components/RoutineList/RoutineList.jsx";
import Toast from "../components/Toast/Toast.jsx";
import useRoutines from "../hooks/useRoutines.js";
import useStudyPassword from "../hooks/useStudyPassword.js";
import useToast from "../hooks/useToast.js";
import { getStudyReturnPath, isValidStudyId } from "../utils/studyNavigation.js";
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

  const {
    isPasswordModalOpen,
    verifiedPassword,
    isVerifying,
    passwordError,
    handleVerifyPassword,
    closePasswordModal,
  } = useStudyPassword(studyId, handleRequestError);
  const {
    routineData,
    isLoadingRoutines,
    routineError,
    pendingRoutineIds,
    reloadRoutines,
    saveRoutines,
    handleToggleRoutine,
  } = useRoutines(studyId, verifiedPassword, handleRequestError);

  const handleClosePasswordModal = () => {
    closePasswordModal();
    goBack();
  };

  const handleSaveRoutines = async (changes) => {
    const saved = await saveRoutines(changes);
    if (saved) showToast("습관 목록을 저장했어요.", "point");
    return saved;
  };

  const isLoading = isLoadingStudy ||
    (!studyError && (verifiedPassword === null || isLoadingRoutines));
  const errorMessage = studyError?.message || routineError;

  if (entryErrorMessage) {
    return <Popup message={entryErrorMessage} onClose={goBack} />;
  }

  return (
    <>
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.containerHeader}>
            <h2 className={styles.studyTitle}>{study?.name || "스터디"}</h2>
            <nav>
              <Link to={`/challenge?id=${studyId}`}>오늘의 집중</Link>
              <Link to={`/dashboard/${studyId}`}>스터디 상세</Link>
            </nav>
          </div>
          <CurrentTime
            serverTime={routineData?.serverTime}
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
                onRetry={studyError ? reloadStudy : reloadRoutines}
                onToggle={handleToggleRoutine}
              />
            </div>
          </div>
        </div>
      </main>
      <PasswordModal
        isOpen={isPasswordModalOpen && Boolean(study) && !isLoadingStudy && !studyError}
        isPending={isVerifying}
        errorMessage={passwordError}
        onSubmit={handleVerifyPassword}
        onClose={handleClosePasswordModal}
      />
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
