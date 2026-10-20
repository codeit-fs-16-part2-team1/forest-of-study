const segmenter = new Intl.Segmenter("ko", {
  granularity: "grapheme",
});

const textRules = [
  { name: "nickname", label: "닉네임", max: 10 },
  { name: "name", label: "스터디 이름", max: 15 },
  { name: "introduction", label: "소개", max: 100 },
];

const passwordPattern = /^[A-Za-z0-9!@#$%^&*]{4,20}$/;

export const validateStudyFields = (values) => {
  const errors = {};

  textRules.forEach(({ name, label, max }) => {
  const length = [...segmenter.segment(values[name].trim())].length;

  if (length === 0) {
    errors[name] =
      name === "name"
        ? "*스터디 이름을 입력해주세요"
        : `${label}는 앞뒤 공백을 제외하고 1~${max}글자로 입력해주세요.`;
  } else if (length > max) {
    errors[name] = `${label}는 앞뒤 공백을 제외하고 1~${max}글자로 입력해주세요.`;
  }
});

  return errors;
};

export const validateStudy = (values) => {
  const errors = validateStudyFields(values);

  ["password", "passwordConfirm"].forEach((name) => {
    if (/\s/u.test(values[name])) {
      errors[name] = "비밀번호에는 공백을 사용할 수 없습니다.";
    } else if (!passwordPattern.test(values[name])) {
      errors[name] =
        "영문, 숫자, 특수문자 !@#$%^&*를 사용해 4~20자로 입력해주세요.";
    }
  });

  if (
    !errors.password &&
    !errors.passwordConfirm &&
    values.password !== values.passwordConfirm
  ) {
    errors.passwordConfirm = "*비밀번호가 일치하지 않습니다";
  }

  return errors;
};
