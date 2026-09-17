import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import UserDashboard from './pages/UserDashboard.jsx';
import ReportIssue from './pages/ReportIssue.jsx';
import MyIssues from './pages/MyIssues.jsx';
import IssueDetails from './pages/IssueDetails.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminIssueDetails from './pages/AdminIssueDetails.jsx';
import AdminRankings from './pages/AdminRankings.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminProtectedRoute from './components/AdminProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Citizen */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
      <Route path="/report" element={<ProtectedRoute><ReportIssue /></ProtectedRoute>} />
      <Route path="/my-issues" element={<ProtectedRoute><MyIssues /></ProtectedRoute>} />
      <Route path="/my-issues/:id" element={<ProtectedRoute><IssueDetails /></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
      <Route path="/admin/issues/:id" element={<AdminProtectedRoute><AdminIssueDetails /></AdminProtectedRoute>} />
      <Route path="/admin/rankings" element={<AdminProtectedRoute><AdminRankings /></AdminProtectedRoute>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
