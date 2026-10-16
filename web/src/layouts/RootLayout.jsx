import { Outlet } from 'react-router';
import Header from '../components/Header/Header.jsx';

const RootLayout = () => {
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
};

export default RootLayout;