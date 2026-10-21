import { useNavigate } from "react-router";
import { studyApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";
import { studyBackgrounds } from "../constants/studyBackgrounds.js";
import { studyPatterns } from "../constants/studyPatterns.js";
import { getCustomBackgroundTheme, getPatternTextBackground, getStudyTextColor, isValidStudyPattern } from "../utils/studyBackground.js";
import StudyPatternLayer, { StudyPatternText } from "../components/StudyPatternLayer/StudyPatternLayer.jsx";
import { validateStudy, validateStudyFields } from "../utils/validateStudy.js";
import { isValidStudyPassword, studyPasswordMessages } from "../utils/studyPassword.js";
import useToast from "../hooks/useToast.js";
import Toast from "../components/Toast/Toast.jsx";
import styles from "./RegPage.module.scss";
import { useEffect, useRef, useState } from "react";

const initialValues = {
  nickname: "",
  name: "",
  introduction: "",
  backgroundKey: "green",
  backgroundColor: "#e1edde",
  patternKey: "",
  patternColor: "#ff52dc",
  textColor: "#14151a",
  useDefaultTextColor: true,
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

const RegPage = ({ study = null, verifiedPassword = null }) => {
  const isEditing = study !== null;
  const navigate = useNavigate();
  const formRef = useRef(null);
  const submittingRef = useRef(false);
  const activeRequestRef = useRef(null);

  useEffect(() => {
  return () => {
    activeRequestRef.current = null;
  };
}, []);

  const [values, setValues] = useState(() => study ? {
    ...initialValues,
    nickname: study.nickname,
    name: study.name,
    introduction: study.introduction,
    backgroundKey: study.backgroundKey,
    backgroundColor: study.backgroundColor ?? initialValues.backgroundColor,
    patternKey: study.patternKey ?? initialValues.patternKey,
    patternColor: study.patternColor ?? initialValues.patternColor,
    textColor: study.textColor ?? initialValues.textColor,
    useDefaultTextColor: study.textColor == null,
  } : initialValues);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toasts, showToast } = useToast();
  const [visiblePasswords, setVisiblePasswords] = useState({
    password: false,
    passwordConfirm: false,
  });
  const customTheme = getCustomBackgroundTheme(values.backgroundColor);
  const customTextColor = values.useDefaultTextColor
    ? undefined
    : getStudyTextColor(values.backgroundKey, values.textColor);
  const hasPattern = isValidStudyPattern(values.patternKey, values.patternColor);
  const contentBackground = getPatternTextBackground(values.backgroundColor, customTextColor);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setValues((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "backgroundKey" && value !== "custom" ? { useDefaultTextColor: true, patternKey: "" } : {}),
    }));
    setErrors((previous) => ({
      ...previous,
      [name]: undefined,
      ...(name === "backgroundKey" || name === "useDefaultTextColor" ? { textColor: undefined } : {}),
      ...(name === "backgroundKey" || name === "patternKey" ? { patternKey: undefined, patternColor: undefined } : {}),
    }));
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

    const { name } = event.currentTarget;

    setErrors((previous) => ({
      ...previous,
      [name]: "비밀번호에는 공백을 사용할 수 없습니다.",
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

    const nextErrors = isEditing ? validateStudyFields(values) : validateStudy(values);
    setErrors(nextErrors);
    setSubmitError("");

    const firstInvalidField = Object.keys(nextErrors)[0];

    if (firstInvalidField) {
      const invalidControl = formRef.current?.elements.namedItem(firstInvalidField);
      if (typeof invalidControl?.focus === "function") invalidControl.focus();
      else invalidControl?.[0]?.focus();
      return;
    }

    if (isEditing && !isValidStudyPassword(verifiedPassword)) {
      setSubmitError(studyPasswordMessages.invalid);
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    const requestId = Symbol(isEditing ? "updateStudy" : "createStudy");
    activeRequestRef.current = requestId;

    try {
      const fields = {
        nickname: values.nickname.trim(),
        name: values.name.trim(),
        introduction: values.introduction.trim(),
        backgroundKey: values.backgroundKey,
        backgroundColor: values.backgroundKey === "custom" ? values.backgroundColor : null,
        patternKey: values.backgroundKey === "custom" && values.patternKey ? values.patternKey : null,
        patternColor: values.backgroundKey === "custom" && values.patternKey ? values.patternColor : null,
        textColor: values.backgroundKey === "custom" && !values.useDefaultTextColor
          ? values.textColor
          : null,
      };
      // 비밀번호는 수정 본문에 포함하지 않고 보호 헤더로 전달한다.
      const { data } = isEditing
        ? await studyApi.update(study.id, fields, verifiedPassword)
        : await studyApi.create({
          ...fields,
          password: values.password,
          passwordConfirm: values.passwordConfirm,
        });

      if (activeRequestRef.current !== requestId) return;

      navigate(`/dashboard/${data.id}`, {
        state: isEditing ? null : { createdStudyId: data.id },
      });
    } catch (error) {
      if (activeRequestRef.current !== requestId) return;

      const apiError = getApiError(error);

      if (apiError.code === "PASSWORD_CONFIRM_MISMATCH") {
        setErrors((previous) => ({
          ...previous,
          passwordConfirm: "*비밀번호가 일치하지 않습니다",
        }));
      } else if (!isEditing && apiError.code === "STUDY_CONFLICT") {
        setSubmitError("같은 닉네임과 스터디 이름으로 등록된 스터디가 있습니다.");
      } else {
        setSubmitError(apiError.message);
      }
    } finally {
      if (activeRequestRef.current === requestId) {
      activeRequestRef.current = null;
      submittingRef.current = false;
      setIsSubmitting(false);
      }
     }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="reg-title">
        <h2 id="reg-title" className={styles.title}>
          {isEditing ? "스터디 수정" : "스터디 만들기"}
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
                  onBlur={isEditing ? () => setErrors(validateStudyFields(values)) : undefined}
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
            <div className={styles.customBackground}>
              <label className={styles.customOption}>
                <input
                  type="radio"
                  name="backgroundKey"
                  value="custom"
                  checked={values.backgroundKey === "custom"}
                  onChange={handleChange}
                />
                직접 색상 선택
              </label>
              {values.backgroundKey === "custom" && (
                <>
                  <div className={styles.colorSettings}>
                    <div className={styles.colorControls}>
                      <label htmlFor="reg-backgroundColor">배경 색상</label>
                      <input
                        id="reg-backgroundColor"
                        name="backgroundColor"
                        type="color"
                        className={styles.colorInput}
                        value={values.backgroundColor}
                        onChange={handleChange}
                        aria-invalid={Boolean(errors.backgroundColor)}
                        aria-describedby={errors.backgroundColor ? "backgroundColor-error" : undefined}
                      />
                      <output htmlFor="reg-backgroundColor">{values.backgroundColor}</output>
                    </div>
                    <div className={styles.colorControls}>
                      <label htmlFor="reg-patternColor">무늬 색상</label>
                      <input
                        id="reg-patternColor"
                        name="patternColor"
                        type="color"
                        className={styles.colorInput}
                        value={values.patternColor}
                        onChange={handleChange}
                        aria-invalid={Boolean(errors.patternColor)}
                        aria-describedby={errors.patternColor ? "patternColor-error" : undefined}
                      />
                      <output htmlFor="reg-patternColor">{values.patternColor}</output>
                    </div>
                    <div className={styles.colorControls}>
                      <label htmlFor="reg-textColor">글자 색상</label>
                      {values.useDefaultTextColor ? (
                        <button
                          id="reg-textColor"
                          type="button"
                          className={`${styles.colorInput} ${styles.colorGuideButton}`}
                          aria-label="글자 색상 변경 안내"
                          onClick={() => showToast("기본 글자색 허용체크를 풀어주세요", "warning")}
                        >
                          <span
                            className={styles.colorGuideSwatch}
                            style={{ backgroundColor: values.textColor }}
                            aria-hidden="true"
                          />
                        </button>
                      ) : (
                        <input
                          id="reg-textColor"
                          name="textColor"
                          type="color"
                          className={styles.colorInput}
                          value={values.textColor}
                          onChange={handleChange}
                          aria-invalid={Boolean(errors.textColor)}
                          aria-describedby={errors.textColor ? "textColor-error" : undefined}
                        />
                      )}
                      {!values.useDefaultTextColor && (
                        <output htmlFor="reg-textColor">{values.textColor}</output>
                      )}
                    </div>
                  </div>
                  <fieldset className={styles.patternField}>
                    <legend>패턴</legend>
                    <div className={styles.patternGrid}>
                      {[{ key: "", label: "없음" }, ...studyPatterns].map(({ key, label }) => (
                        <label key={key} className={styles.patternOption}>
                          <input
                            type="radio"
                            name="patternKey"
                            value={key}
                            checked={values.patternKey === key}
                            onChange={handleChange}
                            aria-invalid={Boolean(errors.patternKey)}
                            aria-describedby={errors.patternKey ? "patternKey-error" : undefined}
                          />
                          <span
                            className={styles.patternPreview}
                            style={{ backgroundColor: values.backgroundColor }}
                            aria-hidden="true"
                          >
                            <StudyPatternLayer patternKey={key} patternColor={values.patternColor} />
                          </span>
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className={styles.customOption}>
                    <input
                      type="checkbox"
                      name="useDefaultTextColor"
                      checked={values.useDefaultTextColor}
                      onChange={handleChange}
                    />
                    기본 글자색 사용 (자동 대비)
                  </label>
                  {errors.backgroundColor && (
                    <p id="backgroundColor-error" className={styles.error} role="alert">
                      {errors.backgroundColor}
                    </p>
                  )}
                  {errors.textColor && (
                    <p id="textColor-error" className={styles.error} role="alert">
                      {errors.textColor}
                    </p>
                  )}
                  {errors.patternKey && (
                    <p id="patternKey-error" className={styles.error} role="alert">{errors.patternKey}</p>
                  )}
                  {errors.patternColor && (
                    <p id="patternColor-error" className={styles.error} role="alert">{errors.patternColor}</p>
                  )}
                  {customTheme && (
                    <div
                      className={styles.customPreview}
                      role="group"
                      aria-label="사용자 지정 배경 미리보기"
                      style={{
                        backgroundColor: customTheme.backgroundColor,
                        color: customTheme.textColor,
                        "--custom-content-color": customTextColor ?? customTheme.textColor,
                      }}
                    >
                      {hasPattern && <StudyPatternLayer patternKey={values.patternKey} patternColor={values.patternColor} />}
                      <p className={styles.previewTitle}>
                        <StudyPatternText active={hasPattern} backgroundColor={contentBackground}>
                          {values.nickname.trim() || "닉네임"}의 {values.name.trim() || "스터디 이름"}
                        </StudyPatternText>
                      </p>
                      <p className={styles.previewIntroduction}>
                        <StudyPatternText active={hasPattern} backgroundColor={contentBackground}>
                          {values.introduction.trim() || "선택한 색상이 카드 배경에 적용됩니다."}
                        </StudyPatternText>
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </fieldset>

          {!isEditing && passwordFields.map(({ name, label, placeholder }) => (
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
            disabled={isSubmitting || (isEditing && !verifiedPassword)}
          >
            {isEditing
              ? isSubmitting ? "수정 중..." : "수정하기"
              : isSubmitting ? "만드는 중..." : "만들기"}
          </button>
        </form>
      </section>
      <Toast toasts={toasts} />
    </main>
  );
};

export default RegPage;
