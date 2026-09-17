import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Citizen-only route guard. An admin token (or no token) is redirected
// away — Section 46: citizens/admins can't reach the other's pages just
// by typing the URL.
export default function ProtectedRoute({ children }) {
  const { isAuthed, role } = useAuth();
  if (!isAuthed || role !== 'CITIZEN') {
    return <Navigate to="/login" replace />;
  }
  return children;
}
