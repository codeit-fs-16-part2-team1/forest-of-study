import { Route, Routes, useLocation, useMatch } from "react-router";
import RootLayout from "./layouts/RootLayout.jsx";
import MainPage from "./pages/MainPage.jsx";
import RegPage from "./pages/RegPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import RoutinesPage from "./pages/RoutinesPage.jsx";
import ChallengePage from "./pages/ChallengePage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

const App = () => {
  const url = useLocation();
  const dashboardMatch = useMatch("/dashboard/:id");
  const path = dashboardMatch ? "dashboard" : url.pathname.slice(1);

  const pageTitle = {
    reg: "스터디 등록 | 공부의 숲",
    dashboard: "스터디 상세 | 공부의 숲",
    routines: "오늘의 습관 | 공부의 숲",
    challenge: "오늘의 집중 | 공부의 숲",
  };

  document.title = pageTitle[path] ?? "공부의 숲";

  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<MainPage />} />
        <Route path="reg" element={<RegPage />} />
        <Route path="dashboard/:id" element={<DashboardPage />} />
        <Route path="routines" element={<RoutinesPage />} />
        <Route path="challenge" element={<ChallengePage />} />
      </Route>
      <Route path='*' element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;