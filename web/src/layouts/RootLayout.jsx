import { Outlet } from 'react-router';
import Header from '../components/Header/Header.jsx';
import styles from './RootLayout.module.scss';

const RootLayout = () => {
  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
};

export default RootLayout;
