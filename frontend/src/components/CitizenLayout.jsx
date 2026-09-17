import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, CirclePlus, ListChecks, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function CitizenLayout({ children }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Civic Issue Reporter
          <span>{profile?.name}</span>
        </div>
        <nav>
          <NavLink to="/dashboard" end><LayoutGrid size={17} /> Dashboard</NavLink>
          <NavLink to="/report"><CirclePlus size={17} /> Report new issue</NavLink>
          <NavLink to="/my-issues"><ListChecks size={17} /> My issues</NavLink>
          <button className="linklike" onClick={handleLogout}><LogOut size={17} /> Log out</button>
        </nav>
        <div className="sidebar-foot">Signed in as citizen</div>
      </aside>
      <main className="main-panel">{children}</main>
    </div>
  );
}
