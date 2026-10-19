import playDesktop from "../../assets/challenge/playDesktop.svg";
import playMobile from "../../assets/challenge/playMobile.svg";
import pauseDesktopBackground from "../../assets/challenge/pauseDesktopBackground.svg";
import pauseMobileBackground from "../../assets/challenge/pauseMobileBackground.svg";
import resetDesktopBackground from "../../assets/challenge/resetDesktopBackground.svg";
import resetMobileBackground from "../../assets/challenge/resetMobileBackground.svg";
import inactiveDesktopBackground from "../../assets/challenge/inactiveDesktopBackground.svg";
import inactiveMobileBackground from "../../assets/challenge/inactiveMobileBackground.svg";
import pauseDesktop from "../../assets/challenge/pauseDesktop.svg";
import pauseMobile from "../../assets/challenge/pauseMobile.svg";
import resetDesktop from "../../assets/challenge/resetDesktop.svg";
import resetMobile from "../../assets/challenge/resetMobile.svg";
import "./challengeControls.scss";

const ChallengeControls = ({
  status = null,
  isPending = false,
  onStart,
  onPause,
  onReset,
  onDismissCompletion,
}) => {
  const isRunning = status === "RUNNING";
  const isPaused = status === "PAUSED";
  const isCompleted = status === "COMPLETED";
  const pauseDisabled = isPending || !isRunning || !onPause;
  const resetDisabled = isPending || !isPaused || !onReset;

  return (
    <div className="challengeControls" role="group" aria-label="집중 타이머 조작">
      {(isRunning || isPaused) && (
        <button
          type="button"
          className="challengeControls__circle"
          aria-label="집중 일시정지"
          disabled={pauseDisabled}
          onClick={onPause}
        >
          <img className="challengeControls__desktop" src={pauseDisabled ? inactiveDesktopBackground : pauseDesktopBackground} alt="" />
          <img className="challengeControls__mobile" src={pauseDisabled ? inactiveMobileBackground : pauseMobileBackground} alt="" />
          <img className="challengeControls__desktop challengeControls__pauseIcon" src={pauseDesktop} alt="" />
          <img className="challengeControls__mobile challengeControls__pauseIcon" src={pauseMobile} alt="" />
        </button>
      )}

      {isCompleted ? (
        <button
          type="button"
          className="challengeControls__primary"
          disabled={isPending || !onDismissCompletion}
          onClick={onDismissCompletion}
          aria-label="집중 완료 화면 닫기"
        >
          Stop!
        </button>
      ) : (
        <button
          type="button"
          className="challengeControls__primary"
          disabled={isPending || isRunning || !onStart}
          onClick={onStart}
          aria-label={isPaused ? "집중 재개" : "집중 시작"}
        >
          <img className="challengeControls__desktop" src={playDesktop} alt="" />
          <img className="challengeControls__mobile" src={playMobile} alt="" />
          Start!
        </button>
      )}

      {(isRunning || isPaused) && (
        <button
          type="button"
          className="challengeControls__circle"
          aria-label="집중 초기화"
          disabled={resetDisabled}
          onClick={onReset}
        >
          <img className="challengeControls__desktop" src={resetDisabled ? inactiveDesktopBackground : resetDesktopBackground} alt="" />
          <img className="challengeControls__mobile" src={resetDisabled ? inactiveMobileBackground : resetMobileBackground} alt="" />
          <img className="challengeControls__desktop challengeControls__resetIcon" src={resetDesktop} alt="" />
          <img className="challengeControls__mobile challengeControls__resetIcon" src={resetMobile} alt="" />
        </button>
      )}
    </div>
  );
};

export default ChallengeControls;
