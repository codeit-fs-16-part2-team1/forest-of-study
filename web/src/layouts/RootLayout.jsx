import { Outlet } from 'react-router';
import Header from '../components/Header/Header.jsx';

const RootLayout = () => {
  return (
    <div className="appLayout">
      <Header />
      <Outlet />
    </div>
  );
};

export default RootLayout;
