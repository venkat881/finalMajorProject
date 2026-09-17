import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import CitizenLayout from '../components/CitizenLayout.jsx';
import CameraCapture from '../components/CameraCapture.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const CATEGORIES = ['Pothole', 'Street Light / Electricity', 'Water Leakage', 'Drainage', 'Garbage'];

export default function ReportIssue() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [photo, setPhoto] = useState(null);

  const [mandals, setMandals] = useState([]);
  const [mandalChoice, setMandalChoice] = useState(''); // '' = auto-detect, '__new__' = add new, else mandal id
  const [newMandalName, setNewMandalName] = useState('');
  const [location, setLocation] = useState(null); // { lat, lng }
  const [locationError, setLocationError] = useState('');
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | requesting | granted | denied

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { success, message, data }

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationError('Your browser does not support location services.');
      return;
    }
    setLocationStatus('requesting');
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: pos.timestamp });
        setLocationStatus('granted');
      },
      (err) => {
        console.error(err);
        setLocationStatus('denied');
        setLocationError('Location access is required so the report can be routed to the correct mandal.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  useEffect(() => {
    requestLocation();
    api.get('/mandals').then((res) => setMandals(res.data.data)).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!category) return setError('Please select an issue category');
    if (!description.trim()) return setError('Please describe the issue');
    if (!address.trim()) return setError('Please enter the address');
    if (!photo) return setError('Please capture a photograph using the camera');
    if (!location) return setError('Location is required — please allow location access');
    if (!mandalChoice) return setError('Please select a mandal');
    if (mandalChoice === '__new__' && !newMandalName.trim()) {
      return setError('Please type a name for the new mandal, or pick an existing one');
    }

    setSubmitting(true);

    // If the citizen typed a brand-new mandal name, create it first so we
    // have a real mandal id to attach to the issue.
    let resolvedMandalId = '';
    if (mandalChoice === '__new__') {
      try {
        const created = await api.post('/mandals', { name: newMandalName.trim() });
        resolvedMandalId = created.data.data.id;
      } catch (err) {
        setSubmitting(false);
        return setError(err.response?.data?.message || 'Failed to create the new mandal');
      }
    } else if (mandalChoice !== '__auto__') {
      resolvedMandalId = mandalChoice;
    }
    // mandalChoice === '__auto__' leaves resolvedMandalId blank, so the
    // backend falls back to automatic GPS-based routing.

    const formData = new FormData();
    formData.append('category', category);
    formData.append('description', description.trim());
    formData.append('address', address.trim());
    formData.append('landmark', landmark.trim());
    formData.append('latitude', location.lat);
    formData.append('longitude', location.lng);
    formData.append('capturedAt', new Date().toISOString());
    formData.append('photo', photo);
    if (resolvedMandalId) formData.append('mandalId', resolvedMandalId);

    try {
      const res = await api.post('/issues', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.debugDetail ? `${data.message}: ${data.debugDetail}` : (data?.message || 'Failed to submit issue. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <CitizenLayout>
        <div className="card" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
          <h2>{result.success ? 'Issue submitted successfully' : result.message}</h2>
          {result.data?.issueCode && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--navy-deep)' }}>
              {result.data.issueCode}
            </p>
          )}
          {result.success && (
            <>
              <p>Mandal: <strong>{result.data.mandal || 'Being determined'}</strong></p>
              <p>Status: <strong>{result.data.status}</strong></p>
            </>
          )}
          {!result.success && result.data?.existingIssueCode && (
            <>
              <p>Matches existing report <strong>{result.data.existingIssueCode}</strong></p>
              {result.data?.duplicateScore != null && (
                <p>Confidence: <strong>{result.data.duplicateScore}%</strong>{result.data.matchedOn ? ` (matched on ${result.data.matchedOn})` : ''}</p>
              )}
            </>
          )}
          {!result.success && result.message && result.data?.aiCategory !== undefined && (
            <p style={{ color: 'var(--danger)' }}>{result.message}</p>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
            <button className="btn btn-outline" onClick={() => window.location.reload()}>Report another</button>
            <button className="btn btn-primary" onClick={() => navigate('/my-issues')}>View my issues</button>
          </div>
        </div>
      </CitizenLayout>
    );
  }

  return (
    <CitizenLayout>
      <div className="page-head">
        <div>
          <h1>Report a civic issue</h1>
          <p>Capture a photo and your location — we'll verify and route it automatically.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="grid-2">
        <form onSubmit={handleSubmit} className="card">
          <div className="field">
            <label>Reported by</label>
            <input value={`${profile?.name} · ${profile?.phone}`} disabled />
          </div>

          <div className="field">
            <label>Issue category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} required>
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Mandal</label>
            <select value={mandalChoice} onChange={(e) => setMandalChoice(e.target.value)} required>
              <option value="" disabled>Select a mandal</option>
              <option value="__auto__">Auto-detect from my location</option>
              {mandals.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              <option value="__new__">+ Add a new mandal</option>
            </select>
            {mandalChoice === '__new__' && (
              <input
                style={{ marginTop: 8 }}
                value={newMandalName}
                onChange={(e) => setNewMandalName(e.target.value)}
                placeholder="New mandal name"
                required
              />
            )}
          </div>

          <div className="field">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's the issue? How severe is it?" required />
          </div>

          <div className="field">
            <label>Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street / area" required />
          </div>

          <div className="field">
            <label>Landmark (optional)</label>
            <input value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Nearby landmark" />
          </div>

          <div className="field">
            <label>Location</label>
            {locationStatus === 'granted' && location ? (
              <div className="info-banner">
                Location captured: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </div>
            ) : locationStatus === 'requesting' ? (
              <div className="info-banner">Requesting your location…</div>
            ) : (
              <div>
                {locationError && <div className="error-banner">{locationError}</div>}
                <button type="button" className="btn btn-outline" onClick={requestLocation}>Allow location access</button>
              </div>
            )}
          </div>

          <button className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit issue'}
          </button>
        </form>

        <div className="card">
          <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, color: 'var(--navy-deep)', marginBottom: 10 }}>
            Photograph (camera only)
          </label>
          <CameraCapture location={location} onCapture={setPhoto} onClear={() => setPhoto(null)} />
          <p className="hint" style={{ marginTop: 10 }}>
            Camera-captured photograph with GPS location and timestamp verification.
          </p>
        </div>
      </div>
    </CitizenLayout>
  );
}
