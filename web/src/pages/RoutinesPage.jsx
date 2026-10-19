import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import CurrentTime from "../components/CurrentTime/CurrentTime.jsx";
import PasswordModal from "../components/PasswordModal/PasswordModal.jsx";
import RoutineModal from "../components/RoutineModal/RoutineModal.jsx";
import Toast from "../components/Toast/Toast.jsx";
import useRoutines from "../hooks/useRoutines.js";
import useStudyPassword from "../hooks/useStudyPassword.js";
import useToast from "../hooks/useToast.js";
import styles from "./RoutinesPage.module.scss";

const RoutinesPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studyId = searchParams.get("id");
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const { toasts, showToast } = useToast();
  const {
    isPasswordModalOpen,
    verifiedPassword,
    isVerifying,
    passwordError,
    handleVerifyPassword,
    closePasswordModal,
  } = useStudyPassword(studyId);
  const {
    routineData,
    isLoadingRoutines,
    routineError,
    pendingRoutineIds,
    reloadRoutines,
    saveRoutines,
    handleToggleRoutine,
  } = useRoutines(studyId, verifiedPassword, (error) => {
    showToast(error.message, "warning");
  });

  const handleClosePasswordModal = () => {
    const previousPage = location.state?.from;

    closePasswordModal();
    navigate(previousPage || "/", { replace: true });
  };

  const handleSaveRoutines = async (changes) => {
    const saved = await saveRoutines(changes);
    if (saved) showToast("습관 목록을 저장했어요.", "point");
    return saved;
  };

  return (
    <>
      {verifiedPassword !== null && (
        <main className={styles.main}>
          <div className={styles.container}>
            <div className={styles.containerHeader}>
              <h2 className={styles.studyTitle}>연우의 개발공장</h2>
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
                      isLoadingRoutines || Boolean(routineError) || !routineData ||
                      pendingRoutineIds.length > 0
                    }
                  >
                    목록 수정
                  </button>
                </div>
                {isLoadingRoutines ? (
                  <p role="status">습관을 불러오는 중이에요.</p>
                ) : routineError ? (
                  <div>
                    <p role="alert">{routineError}</p>
                    <button type="button" onClick={reloadRoutines}>
                      다시 시도
                    </button>
                  </div>
                ) : routineData?.routines.length === 0 ? (
                  <p>
                    아직 습관이 없어요
                    <br />
                    목록 수정을 눌러 습관을 생성해보세요
                  </p>
                ) : (
                  <ul className={styles.routineList}>
                    {routineData?.routines.map((routine) => (
                      <li key={routine.id}>
                        <button
                          type="button"
                          onClick={() => handleToggleRoutine(routine)}
                          disabled={pendingRoutineIds.includes(routine.id)}
                          className={[
                            styles.routine,
                            routine.completed && styles.checked,
                          ].filter(Boolean).join(" ")}
                          aria-pressed={routine.completed}
                        >
                          {routine.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </main>
      )}
      <PasswordModal
        isOpen={isPasswordModalOpen}
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
