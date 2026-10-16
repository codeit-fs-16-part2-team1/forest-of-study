import axios from "axios";

// ADR-058: 최종 문구 확정 전 사용하는 공통 임시 안내다.
const networkErrorMessage = "서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.";
const defaultErrorMessage = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";

export const getApiError = (error) => {
  const apiError = {
    status: null,
    code: null,
    message: defaultErrorMessage,
    details: null,
  };

  if (!axios.isAxiosError(error)) {
    return apiError;
  }

  if (error.response) {
    const responseError = error.response.data?.error;

    apiError.status = error.response.status;

    if (typeof responseError?.code === "string" && responseError.code.trim() !== "") {
      apiError.code = responseError.code;
    }

    if (typeof responseError?.message === "string" && responseError.message.trim() !== "") {
      apiError.message = responseError.message;
    }

    apiError.details = responseError?.details ?? null;
    return apiError;
  }

  if (error.request) {
    apiError.message = networkErrorMessage;
  }

  return apiError;
};
