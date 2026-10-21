import useMinimumLoading from "../../hooks/useMinimumLoading.js";
import { useEffect, useId, useState } from "react";
import { studyApi } from "../../api/api.js";
import { getApiError } from "../../api/apiError.js";
import {
  emptySticker,
  routineStickers,
} from "../../constants/routineStickers.js";
import { getKoreanDate } from "../../utils/studyDate.js";
import styles from "./RoutineHistoryTable.module.scss";

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];

const getWeekDates = (weekStart) =>
  weekdays.map((_, index) => {
    const date = new Date(`${weekStart}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });

const getCellLabel = (completed) => {
  if (completed === true) return "완료";
  if (completed === false) return "미완료";
  return "사용 기간 밖";
};

const RoutineHistoryTable = ({ studyId }) => {
  const headingId = useId();
  const [today, setToday] = useState(() => getKoreanDate());
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState(null);

  const requestKey = `${studyId}:${today}:${retryCount}`;

  // 페이지를 열어둔 채 한국 날짜가 바뀌는 경우에도 갱신합니다.
  useEffect(() => {
    const updateDate = () => setToday(getKoreanDate());
    const intervalId = window.setInterval(updateDate, 60000);

    window.addEventListener("focus", updateDate);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", updateDate);
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const fetchHistory = async () => {
      try {
        const { data } = await studyApi.getRoutineHistories(
          studyId,
          today
        );

        if (ignore) return;

        setResult({
          requestKey,
          data,
          error: null,
        });
      } catch (error) {
        if (ignore) return;

        setResult({
          requestKey,
          data: null,
          error: getApiError(error),
        });
      }
    };

    fetchHistory();

    return () => {
      ignore = true;
    };
  }, [studyId, today, requestKey]);

  const isLoading = useMinimumLoading(result?.requestKey !== requestKey, requestKey);
  const data = isLoading ? null : result.data;
  const error = isLoading ? null : result.error;
  const dates = data ? getWeekDates(data.weekStart) : [];

  return (
    <section
      className={styles.section}
      aria-labelledby={headingId}
      aria-busy={isLoading}
    >
      <h2 id={headingId} className={styles.title}>
        습관 기록표
      </h2>

      {isLoading ? (
        <>
          <p className={styles.srOnly} role="status">
            습관 기록을 불러오는 중입니다.
          </p>

          <div className={styles.skeleton} aria-hidden="true" />
        </>
      ) : error ? (
        <div className={styles.status}>
          <p className={styles.error} role="alert">
            {error.message}
          </p>

          <button
            type="button"
            className={styles.retry}
            onClick={() => setRetryCount((count) => count + 1)}
          >
            다시 시도
          </button>
        </div>
      ) : data.routines.length === 0 ? (
        <p className={styles.status} role="status">
          이번 주에 표시할 습관이 없어요
        </p>
      ) : (
        <div
          className={styles.scroll}
          role="region"
          aria-labelledby={headingId}
          tabIndex={0}
        >
          <table className={styles.table}>
            <caption className={styles.srOnly}>
              {dates[0]}부터 {dates[6]}까지의 습관 기록
            </caption>

            <thead>
              <tr>
                <th scope="col">
                  <span className={styles.srOnly}>습관 이름</span>
                </th>

                {weekdays.map((weekday, index) => (
                  <th key={weekday} scope="col">
                    <time dateTime={dates[index]} title={dates[index]}>
                      {weekday}
                    </time>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {data.routines.map((routine, rowIndex) => (
                <tr key={routine.id}>
                  <th scope="row">{routine.name}</th>

                  {routine.cells.map(({ recordDate, completed }) => (
                    <td key={recordDate}>
                      <span className={styles.sticker}>
                        <img
                          src={
                            completed === true
                              ? routineStickers[
                                  rowIndex % routineStickers.length
                                ]
                              : emptySticker
                          }
                          width="36"
                          height="36"
                          alt={`${recordDate} ${getCellLabel(completed)}`}
                        />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default RoutineHistoryTable;