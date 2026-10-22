import { Outlet } from 'react-router';
import Header from '../components/Header/Header.jsx';
import ForestScene from '../components/ForestScene/ForestScene.jsx';

const RootLayout = () => {
  return (
    <div className="appLayout">
      <Header />
      <Outlet />
      <ForestScene />
    </div>
  );
};

export default RootLayout;
