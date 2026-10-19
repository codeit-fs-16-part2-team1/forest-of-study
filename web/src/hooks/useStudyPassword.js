import { useEffect, useRef, useState } from "react";
import { studyApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";

// 사용하는 페이지는 key={studyId}로 스터디별 상태를 초기화합니다.
const useStudyPassword = (studyId) => {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(true);
  const [verifiedPassword, setVerifiedPassword] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const isPageActiveRef = useRef(true);

  useEffect(() => {
    isPageActiveRef.current = true;

    return () => {
      isPageActiveRef.current = false;
    };
  }, []);

  const handleVerifyPassword = async (password) => {
    if (!studyId || isVerifying) return;

    setPasswordError("");
    setIsVerifying(true);

    try {
      const { data } = await studyApi.verifyPassword(studyId, password);

      if (!isPageActiveRef.current) return;

      if (data.verified === true) {
        setVerifiedPassword(password);
        setIsPasswordModalOpen(false);
      }
    } catch (error) {
      if (!isPageActiveRef.current) return;
      setPasswordError(getApiError(error).message);
    } finally {
      if (isPageActiveRef.current) {
        setIsVerifying(false);
      }
    }
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setPasswordError("");
  };

  return {
    isPasswordModalOpen,
    verifiedPassword,
    isVerifying,
    passwordError,
    handleVerifyPassword,
    closePasswordModal,
  };
};

export default useStudyPassword;
