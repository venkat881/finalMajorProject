import { useEffect, useState } from 'react';
import api from '../api/axios.js';
import AdminLayout from '../components/AdminLayout.jsx';

const MEDALS = ['🏆', '🥈', '🥉'];

export default function AdminRankings() {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/rankings').then((res) => {
      setRankings(res.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <AdminLayout>
      <div className="page-head">
        <div>
          <h1>Mandal performance rankings</h1>
          <p>Weighted score across resolution rate, citizen rating, and resolution speed.</p>
        </div>
      </div>

      {loading ? <p>Loading…</p> : (
        <ul className="rank-list">
          {rankings.map((r) => (
            <li key={r.mandalId} className="rank-item">
              <div className="rank-medal">{MEDALS[r.rank - 1] || r.rank}</div>
              <div className="rank-name">{r.mandalName}</div>
              <div className="meta" style={{ marginRight: 16, fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
                {r.resolutionRate.toFixed(0)}% resolved · {r.avgRating ? r.avgRating.toFixed(1) : '—'}★ avg
                {r.avgResolutionHours != null ? ` · ${Math.round(r.avgResolutionHours)}h avg` : ''}
              </div>
              <div className="rank-score">{r.score}</div>
            </li>
          ))}
        </ul>
      )}
    </AdminLayout>
  );
}
