import { Route, Routes, useLocation, useMatch, useSearchParams } from "react-router";
import { useStudyTitleData } from "./hooks/useStudyTitleData.js";
import RootLayout from "./layouts/RootLayout.jsx";
import MainPage from "./pages/MainPage.jsx";
import RegPage from "./pages/RegPage.jsx";
import EditStudyPage from "./pages/EditStudyPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import RoutinesPage from "./pages/RoutinesPage.jsx";
import ChallengeEntryPage from "./pages/ChallengeEntryPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import ModalPreview from "./dev/ModalPreview/ModalPreview.jsx";
import RoutePreview from "./dev/RoutePreview/RoutePreview.jsx";

const App = () => {
  const { pathname } = useLocation();
  const dashboardMatch = useMatch("/dashboard/:id");
  const routinesMatch = useMatch("/routines");
  const challengeMatch = useMatch("/challenge");
  const regMatch = useMatch("/reg");
  const [searchParams] = useSearchParams();
  let studyId = null;

  if (dashboardMatch) {
    studyId = dashboardMatch.params.id;
  } else if (routinesMatch || challengeMatch || regMatch) {
    studyId = searchParams.get("id");
  }

  const studyState = useStudyTitleData(studyId, pathname);
  const {
    study,
    isLoading: isStudyLoading,
    error: studyError,
    updateReactions,
  } = studyState;
  const studyName = study?.name;

  let pageTitle = "공부의 숲";

  if (dashboardMatch) {
    pageTitle = studyName ? `${studyName} | 공부의 숲` : "스터디 상세 | 공부의 숲";
  } else if (routinesMatch) {
    pageTitle = `오늘의 루틴 | ${studyName || "공부의 숲"}`;
  } else if (challengeMatch) {
    pageTitle = `오늘의 도전 | ${studyName || "공부의 숲"}`;
  } else if (regMatch) {
    pageTitle = searchParams.has("id") ? "스터디 수정 | 공부의 숲" : "스터디 등록 | 공부의 숲";
  }

  return (
    <>
      <title>{pageTitle}</title>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<MainPage />} />
          <Route path="reg" element={searchParams.has("id") ? (
            <EditStudyPage key={`edit:${studyId}`} studyId={studyId} studyState={studyState} />
          ) : <RegPage key="create" />} />
          <Route
            path="dashboard/:id"
            element={
              <DashboardPage
                key={studyId}
                study={study}
                isLoading={isStudyLoading}
                error={studyError}
                onReactionsChange={updateReactions}
              />
            }
          />
          <Route
            path="routines"
            element={<RoutinesPage key={studyId ?? "missing"} studyState={studyState} />}
          />
          <Route path="challenge" element={
            <ChallengeEntryPage
              key={studyId ?? "missing"}
              studyId={studyId}
              study={study}
              isStudyLoading={isStudyLoading}
              studyError={studyError}
            />
          } />
        </Route>
        {import.meta.env.DEV && (
          <>
            <Route path="/dev/modal" element={<ModalPreview />} />
            <Route path="/dev/routes" element={<RoutePreview />} />
          </>
        )}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
};

export default App;

