import PasswordModal from "./PasswordModal.jsx";

// ISS-050의 UI를 재사용하고, ISS-033 훅의 동작·상태만 연결한다.
const StudyPasswordVerification = ({
  verification,
  title,
  description,
  submitLabel,
  closeLabel,
}) => (
  <PasswordModal
    key={`${verification.studyId}:${verification.formVersion}`}
    isOpen={verification.isOpen}
    title={title}
    description={description}
    submitLabel={submitLabel}
    closeLabel={closeLabel}
    isPending={verification.isPending}
    disabled={!verification.studyId}
    errorMessage={verification.error?.message ?? ""}
    onSubmit={verification.verifyPassword}
    onClose={verification.close}
  />
);

export default StudyPasswordVerification;
