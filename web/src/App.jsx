import { Route, Routes, useMatch, useSearchParams } from "react-router";
import { useStudyTitleData } from "./hooks/useStudyTitleData.js";
import RootLayout from "./layouts/RootLayout.jsx";
import MainPage from "./pages/MainPage.jsx";
import RegPage from "./pages/RegPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import RoutinesPage from "./pages/RoutinesPage.jsx";
import ChallengePage from "./pages/ChallengePage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

const App = () => {
  const dashboardMatch = useMatch("/dashboard/:id");
  const routinesMatch = useMatch("/routines");
  const challengeMatch = useMatch("/challenge");
  const regMatch = useMatch("/reg");
  const [searchParams] = useSearchParams();
  let studyId = null;

  if (dashboardMatch) {
    studyId = dashboardMatch.params.id;
  } else if (routinesMatch || challengeMatch) {
    studyId = searchParams.get("id");
  }

  const { study } = useStudyTitleData(studyId);
  const studyName = study?.name;

  let pageTitle = "공부의 숲";

  if (dashboardMatch) {
    pageTitle = studyName ? `${studyName} | 공부의 숲` : "스터디 상세 | 공부의 숲";
  } else if (routinesMatch) {
    pageTitle = `오늘의 루틴 | ${studyName || "공부의 숲"}`;
  } else if (challengeMatch) {
    pageTitle = `오늘의 도전 | ${studyName || "공부의 숲"}`;
  } else if (regMatch) {
    pageTitle = "스터디 등록 | 공부의 숲";
  }

  return (
    <>
      <title>{pageTitle}</title>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<MainPage />} />
          <Route path="reg" element={<RegPage />} />
          <Route path="dashboard/:id" element={<DashboardPage />} />
          <Route path="routines" element={<RoutinesPage />} />
          <Route path="challenge" element={<ChallengePage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
};

export default App;

