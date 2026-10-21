import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import Toast from "../components/Toast/Toast.jsx";
import useToast from "../hooks/useToast.js";
import { studyApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";
import StudyCard from "../components/StudyCard/StudyCard.jsx";
import RecentStudies from "../components/RecentStudies/RecentStudies.jsx";
import StudySort from "../components/StudySort/StudySort.jsx";
import styles from "./MainPage.module.scss";

const PAGE_SIZE = 6;
const SEARCH_DELAY_MS = 500;

const MainPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toasts, showToast } = useToast();
  const notifiedLocationRef = useRef(null);

  useEffect(() => {
    if (location.state?.studyDeleted !== true || notifiedLocationRef.current === location.key) return;
    notifiedLocationRef.current = location.key;
    showToast("스터디가 삭제되었습니다.", "warning");
    const remainingState = { ...location.state };
    delete remainingState.studyDeleted;
    navigate(location.pathname + location.search + location.hash, {
      replace: true,
      state: remainingState,
    });
  }, [location, navigate, showToast]);
  const [searchInput, setSearchInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const composingRef = useRef(false);
  const searchTimerRef = useRef(null);
  const [query, setQuery] = useState({
    keyword: "",
    sort: "latest",
  });
  const [result, setResult] = useState({
    studies: [],
    offset: 0,
    hasMore: false,
    isLoading: true,
    error: "",
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");

  const generationRef = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const generation = ++generationRef.current;
    let ignore = false;

    const fetchStudies = async () => {
      try {
        const { data, pagination } = await studyApi.getList({
          ...query,
          limit: PAGE_SIZE,
          offset: 0,
        });

        if (ignore || generationRef.current !== generation) return;

        setResult({
          studies: data,
          offset: pagination.offset + data.length,
          hasMore: pagination.hasMore,
          isLoading: false,
          error: "",
        });
      } catch (error) {
        if (ignore || generationRef.current !== generation) return;

        setResult({
          studies: [],
          offset: 0,
          hasMore: false,
          isLoading: false,
          error: getApiError(error).message,
        });
      }
    };

    fetchStudies();

    return () => {
      ignore = true;
      generationRef.current += 1;
    };
  }, [query]);

  const changeQuery = useCallback((nextQuery) => {
    // 이전 조건의 응답이 새 목록에 반영되지 않도록 즉시 무효화합니다.
    generationRef.current += 1;
    loadingMoreRef.current = false;

    setIsLoadingMore(false);
    setMoreError("");
    setResult({
      studies: [],
      offset: 0,
      hasMore: false,
      isLoading: true,
      error: "",
    });
    setQuery(nextQuery);
  }, []);

  useEffect(() => {
    const keyword = searchInput.trim().normalize("NFC");
    if (isComposing || keyword === query.keyword) return;

    searchTimerRef.current = window.setTimeout(() => {
      searchTimerRef.current = null;
      // 대기 중 바뀐 정렬 조건도 유지한다.
      changeQuery((previous) => ({ ...previous, keyword }));
    }, SEARCH_DELAY_MS);

    return () => window.clearTimeout(searchTimerRef.current);
  }, [searchInput, isComposing, query.keyword, changeQuery]);

  const handleSearch = (event) => {
    event.preventDefault();
    if (composingRef.current) return;

    window.clearTimeout(searchTimerRef.current);
    const keyword = searchInput.trim().normalize("NFC");
    setSearchInput(keyword);
    if (keyword !== query.keyword || result.error) {
      changeQuery({ ...query, keyword });
    }
  };

  const handleSortChange = (sort) => {
    changeQuery({ ...query, sort });
  };

  const handleLoadMore = async () => {
    if (
      loadingMoreRef.current ||
      result.isLoading ||
      !result.hasMore
    ) {
      return;
    }

    const generation = generationRef.current;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    setMoreError("");

    try {
      const { data, pagination } = await studyApi.getList({
        ...query,
        limit: PAGE_SIZE,
        offset: result.offset,
      });

      if (generationRef.current !== generation) return;

      setResult((previous) => {
        const existingIds = new Set(
          previous.studies.map(({ id }) => id)
        );

        const additions = data.filter(({ id }) => {
          if (existingIds.has(id)) return false;
          existingIds.add(id);
          return true;
        });

        return {
          ...previous,
          studies: [...previous.studies, ...additions],
          offset: pagination.offset + data.length,
          hasMore: pagination.hasMore,
        };
      });
    } catch (error) {
      if (generationRef.current !== generation) return;

      setMoreError(getApiError(error).message);
    } finally {
      if (generationRef.current === generation) {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  };

  return (
    <main className={styles.page}>
      <RecentStudies />
      <section
        className={styles.section}
        aria-labelledby="browse-title"
      >
        <h2 id="browse-title" className={styles.title}>
          스터디 둘러보기
        </h2>

        <div className={styles.controls}>
          <form
            className={styles.search}
            onSubmit={handleSearch}
            role="search"
          >
            <label htmlFor="study-search" className={styles.srOnly}>
              스터디 검색
            </label>

            <input
              id="study-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onCompositionStart={() => {
                window.clearTimeout(searchTimerRef.current);
                composingRef.current = true;
                setIsComposing(true);
              }}
              onCompositionEnd={(event) => {
                composingRef.current = false;
                setIsComposing(false);
                setSearchInput(event.currentTarget.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" &&
                    (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) {
                  event.preventDefault();
                }
              }}
              placeholder="검색"
            />

            <button type="submit">검색</button>
          </form>

          <StudySort value={query.sort} onChange={handleSortChange} />
        </div>

        <div aria-busy={result.isLoading || isLoadingMore}>
          {result.isLoading ? (
            <>
              <p className={styles.srOnly} role="status">
                스터디를 불러오는 중입니다.
              </p>

              <div className={styles.grid} aria-hidden="true">
                {Array.from({ length: PAGE_SIZE }, (_, index) => (
                  <div key={index} className={styles.skeleton} />
                ))}
              </div>
            </>
          ) : result.error ? (
            <div className={styles.empty}>
              <p role="alert">{result.error}</p>
              <button
                type="button"
                className={styles.retry}
                onClick={() => changeQuery({ ...query })}
              >
                다시 시도
              </button>
            </div>
          ) : result.studies.length === 0 ? (
            <p className={styles.empty} role="status">
              {query.keyword
                ? "검색 결과가 없어요"
                : "아직 둘러 볼 스터디가 없어요"}
            </p>
          ) : (
            <div className={styles.grid}>
              {result.studies.map((study) => (
                <StudyCard key={study.id} study={study} />
              ))}
            </div>
          )}

          {moreError && (
            <p className={styles.error} role="alert">
              {moreError}
            </p>
          )}

          {!result.isLoading && result.hasMore && (
            <button
              type="button"
              className={styles.moreButton}
              onClick={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? "불러오는 중..." : "더보기"}
            </button>
          )}
        </div>
      </section>
      <Toast toasts={toasts} />
    </main>
  );
};

export default MainPage;
