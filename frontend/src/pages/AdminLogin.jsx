import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import ThreeHero from '../components/ThreeHero.jsx';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/admin/login', { email, password });
      const { token, admin } = res.data.data;
      login(token, 'ADMIN', admin);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-side">
        <div className="brand">Civic Issue Reporter · Admin</div>
        <ThreeHero height={300} />
        <div className="pitch">
          <h1>One queue for every mandal, reviewed in one place.</h1>
          <p>
            Photo, location, AI verification result and duplicate signal —
            reviewed together, so closing out an issue takes one look, not five.
          </p>
        </div>
        <div className="foot">Restricted to authorized administrators</div>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-card">
          <div className="brand-mobile">Civic Issue Reporter · Admin</div>
          <h2>Admin login</h2>
          <p>Sign in with your mandal administrator credentials.</p>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>
          <p style={{ marginTop: 18, fontSize: '0.85rem' }}>
            <Link to="/login">← Citizen login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
