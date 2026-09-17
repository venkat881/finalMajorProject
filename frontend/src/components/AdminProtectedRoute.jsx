import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminProtectedRoute({ children }) {
  const { isAuthed, role } = useAuth();
  if (!isAuthed || role !== 'ADMIN') {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}
