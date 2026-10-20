const matchesFields = (fields) => Array.isArray(fields) && fields.length === 2
  && fields.includes("nickname") && fields.includes("name");

export const isStudyCombinationConflict = (error) => {
  if (error?.code !== "P2002") return false;
  const meta = error.meta;
  if (meta?.modelName && meta.modelName !== "Study") return false;
  if (meta?.table && meta.table !== "Study") return false;

  const target = meta?.target;
  if (target === "Study_nickname_name_key" || matchesFields(target)) return true;

  // Prisma 7 PostgreSQL 어댑터는 cause.constraint에 제약 정보를 전달한다.
  const cause = meta?.driverAdapterError?.cause;
  if (cause?.kind !== "UniqueConstraintViolation") return false;
  if (cause.table && cause.table !== "Study") return false;
  return cause.constraint?.index === "Study_nickname_name_key"
    || matchesFields(cause.constraint?.fields);
};
