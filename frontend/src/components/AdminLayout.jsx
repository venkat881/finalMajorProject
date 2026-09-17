import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, Trophy, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminLayout({ children }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/admin/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Civic Issue Reporter
          <span>All mandals · unified admin</span>
        </div>
        <nav>
          <NavLink to="/admin/dashboard" end><LayoutGrid size={17} /> Issue queue</NavLink>
          <NavLink to="/admin/rankings"><Trophy size={17} /> Mandal rankings</NavLink>
          <button className="linklike" onClick={handleLogout}><LogOut size={17} /> Log out</button>
        </nav>
        <div className="sidebar-foot">{profile?.name}</div>
      </aside>
      <main className="main-panel">{children}</main>
    </div>
  );
}
