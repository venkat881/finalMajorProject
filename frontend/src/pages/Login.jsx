import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import ThreeHero from '../components/ThreeHero.jsx';

export default function Login() {
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
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data.data;
      login(token, 'CITIZEN', user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-side">
        <div className="brand">Civic Issue Reporter</div>
        <ThreeHero height={300} />
        <div className="pitch">
          <h1>Report it once. Track it through to resolution.</h1>
          <p>
            Capture a civic issue with your camera, drop a pin at its real
            location, and follow it from AI verification through to the
            mandal admin who closes it out.
          </p>
        </div>
        <div className="foot">A civic issue reporting &amp; routing platform</div>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-card">
          <div className="brand-mobile">Civic Issue Reporter</div>
          <h2>Welcome back</h2>
          <p>Log in to report and track civic issues.</p>
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
          <p style={{ marginTop: 18, fontSize: '0.9rem' }}>
            New here? <Link to="/register">Create an account</Link>
          </p>
          <p style={{ fontSize: '0.85rem' }}>
            <Link to="/admin/login">Admin login →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
