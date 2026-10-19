import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { studyApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";
import { studyBackgrounds } from "../constants/studyBackgrounds.js";
import { validateStudy } from "../utils/validateStudy.js";
import styles from "./RegPage.module.scss";

const initialValues = {
  nickname: "",
  name: "",
  introduction: "",
  backgroundKey: "green",
  password: "",
  passwordConfirm: "",
};

const textFields = [
  {
    name: "nickname",
    label: "닉네임",
    placeholder: "닉네임을 입력해 주세요",
  },
  {
    name: "name",
    label: "스터디 이름",
    placeholder: "스터디 이름을 입력해 주세요",
  },
  {
    name: "introduction",
    label: "소개",
    placeholder: "소개 멘트를 작성해 주세요",
    multiline: true,
  },
];

const passwordFields = [
  {
    name: "password",
    label: "비밀번호",
    placeholder: "비밀번호를 입력해 주세요",
  },
  {
    name: "passwordConfirm",
    label: "비밀번호 확인",
    placeholder: "비밀번호를 다시 한 번 입력해 주세요",
  },
];

const RegPage = () => {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const submittingRef = useRef(false);

  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({
    password: false,
    passwordConfirm: false,
  });

  const handleChange = (event) => {
    const { name, value } = event.target;

    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
    setSubmitError("");
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;

    handleChange(event);

    // 붙여넣기 등으로 들어온 공백도 자동 삭제하지 않고 안내합니다.
    if (/\s/u.test(value)) {
      setErrors((previous) => ({
        ...previous,
        [name]: "비밀번호에는 공백을 사용할 수 없습니다.",
      }));
    }
  };

  const handlePasswordKeyDown = (event) => {
    if (event.key === " ") {
      event.preventDefault();

      setErrors((previous) => ({
        ...previous,
        [event.currentTarget.name]:
          "비밀번호에는 공백을 사용할 수 없습니다.",
      }));
    }
  };

  const togglePassword = (name) => {
    setVisiblePasswords((previous) => ({
      ...previous,
      [name]: !previous[name],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submittingRef.current) return;

    const nextErrors = validateStudy(values);
    setErrors(nextErrors);
    setSubmitError("");

    const firstInvalidField = Object.keys(nextErrors)[0];

    if (firstInvalidField) {
      formRef.current?.elements.namedItem(firstInvalidField)?.focus();
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const { data } = await studyApi.create({
        nickname: values.nickname.trim(),
        name: values.name.trim(),
        introduction: values.introduction.trim(),
        backgroundKey: values.backgroundKey,
        password: values.password,
        passwordConfirm: values.passwordConfirm,
      });

      navigate(`/dashboard/${data.id}`);
    } catch (error) {
      const apiError = getApiError(error);

      if (apiError.code === "PASSWORD_CONFIRM_MISMATCH") {
        setErrors((previous) => ({
          ...previous,
          passwordConfirm: "*비밀번호가 일치하지 않습니다",
        }));
      } else if (apiError.code === "STUDY_CONFLICT") {
        setSubmitError("같은 닉네임과 스터디 이름으로 등록된 스터디가 있습니다.");
      } else {
        setSubmitError(apiError.message);
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="reg-title">
        <h2 id="reg-title" className={styles.title}>
          스터디 만들기
        </h2>

        <form
          ref={formRef}
          className={styles.form}
          onSubmit={handleSubmit}
          aria-busy={isSubmitting}
          noValidate
        >
          {textFields.map(({ name, label, placeholder, multiline }) => {
            const Input = multiline ? "textarea" : "input";

            return (
              <div key={name} className={styles.field}>
                <label htmlFor={`reg-${name}`}>{label}</label>

                <Input
                  id={`reg-${name}`}
                  name={name}
                  className={styles.input}
                  value={values[name]}
                  placeholder={placeholder}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  required
                  aria-invalid={Boolean(errors[name])}
                  aria-describedby={errors[name] ? `${name}-error` : undefined}
                  {...(multiline ? { rows: 3 } : { type: "text" })}
                />

                {errors[name] && (
                  <p id={`${name}-error`} className={styles.error} role="alert">
                    {errors[name]}
                  </p>
                )}
              </div>
            );
          })}

          <fieldset className={styles.backgroundField} disabled={isSubmitting}>
            <legend>배경을 선택해주세요</legend>

            <div className={styles.backgroundGrid}>
             {studyBackgrounds.map(({ key, label, color, image }) => (
            <label key={key} className={styles.backgroundOption}>
             <input
               type="radio"
               name="backgroundKey"
               value={key}
               checked={values.backgroundKey === key}
               onChange={handleChange}
               aria-label={label}
              />

             <span
              className={styles.backgroundPreview}
              style={{ backgroundColor: color }}
             >
             {image && <img src={image} alt="" />}

             {values.backgroundKey === key && (
               <span className={styles.selectedMark} aria-hidden="true">
                ✓
               </span>
              )}
            </span>
           </label>
          ))}
            </div>
          </fieldset>

          {passwordFields.map(({ name, label, placeholder }) => (
            <div key={name} className={styles.field}>
              <label htmlFor={`reg-${name}`}>{label}</label>

              <div className={styles.passwordField}>
                <input
                  id={`reg-${name}`}
                  name={name}
                  className={styles.input}
                  type={visiblePasswords[name] ? "text" : "password"}
                  value={values[name]}
                  placeholder={placeholder}
                  onChange={handlePasswordChange}
                  onKeyDown={handlePasswordKeyDown}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  required
                  aria-invalid={Boolean(errors[name])}
                  aria-describedby={errors[name] ? `${name}-error` : undefined}
                />

                <button
                  type="button"
                  className={styles.visibilityButton}
                  onClick={() => togglePassword(name)}
                  disabled={isSubmitting}
                  aria-label={`${label} ${
                    visiblePasswords[name] ? "숨기기" : "보기"
                  }`}
                  aria-pressed={visiblePasswords[name]}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                    {!visiblePasswords[name] && <path d="m3 3 18 18" />}
                  </svg>
                </button>
              </div>

              {errors[name] && (
                <p id={`${name}-error`} className={styles.error} role="alert">
                  {errors[name]}
                </p>
              )}
            </div>
          ))}

          {submitError && (
            <p className={styles.error} role="alert">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? "만드는 중..." : "만들기"}
          </button>
        </form>
      </section>
    </main>
  );
};

export default RegPage;