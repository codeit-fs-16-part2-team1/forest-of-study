import { useEffect, useState } from "react";
import { BOOKMARK_CHANGE_EVENT, BOOKMARK_STUDIES_KEY, readBookmarkStudyIds } from "../utils/bookmarkStudies.js";

const readSafely = () => {
  try {
    return readBookmarkStudyIds();
  } catch {
    return [];
  }
};

const useBookmarkStudies = () => {
  const [ids, setIds] = useState(readSafely);
  useEffect(() => {
    const sync = () => setIds(readSafely());
    const handleStorage = (event) => {
      if (event.key === BOOKMARK_STUDIES_KEY || event.key === null) sync();
    };
    window.addEventListener(BOOKMARK_CHANGE_EVENT, sync);
    window.addEventListener("storage", handleStorage);
    sync();
    return () => {
      window.removeEventListener(BOOKMARK_CHANGE_EVENT, sync);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);
  return ids;
};

export default useBookmarkStudies;
