import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import ThreeHero from '../components/ThreeHero.jsx';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      const { token, user } = res.data.data;
      login(token, 'CITIZEN', user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
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
          <h1>Your report, routed to the right office automatically.</h1>
          <p>
            No more guessing which office handles what. Submit a photo and
            location — the system verifies it and sends it straight to the
            mandal responsible for your area.
          </p>
        </div>
        <div className="foot">Free to use. Available to every resident.</div>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-card">
          <div className="brand-mobile">Civic Issue Reporter</div>
          <h2>Create your account</h2>
          <p>Register once to start reporting civic issues.</p>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Full name</label>
              <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
            </div>
            <div className="field">
              <label>Phone number</label>
              <input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="10-digit mobile number" required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required />
              <div className="hint">At least 8 characters, with a letter and a number.</div>
            </div>
            <div className="field">
              <label>Confirm password</label>
              <input type="password" value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} required />
            </div>
            <button className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p style={{ marginTop: 18, fontSize: '0.9rem' }}>
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
