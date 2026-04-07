import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--pt-bg)' }}>
      <Sidebar />
      <main style={{ marginLeft: 240, padding: 32, minHeight: '100vh' }}>
        <Outlet />
      </main>
    </div>
  );
}
