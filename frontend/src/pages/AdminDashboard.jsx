import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import AdminLayout from '../components/AdminLayout.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ThreeStatBars from '../components/ThreeStatBars.jsx';

const CATEGORIES = ['Pothole', 'Street Light / Electricity', 'Water Leakage', 'Drainage', 'Garbage'];
const STATUSES = ['PENDING', 'AI_REVIEW', 'COMPLETED', 'CANT_TAKEUP', 'DUPLICATE', 'REJECTED'];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [mandals, setMandals] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ category: '', status: '', date: '', mandalId: '' });

  useEffect(() => {
    api.get('/mandals').then((res) => setMandals(res.data.data)).catch(() => {});
  }, []);

  function loadAll() {
    const params = {};
    if (filters.category) params.category = filters.category;
    if (filters.status) params.status = filters.status;
    if (filters.date) params.date = filters.date;
    if (filters.mandalId) params.mandalId = filters.mandalId;

    api.get('/admin/issues', { params }).then((res) => setIssues(res.data.data));
    api.get('/admin/statistics', { params: filters.mandalId ? { mandalId: filters.mandalId } : {} })
      .then((res) => setStats(res.data.data));
  }

  useEffect(() => {
    loadAll();
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const barData = stats
    ? [
        { label: 'Pending', value: stats.pending, color: 0xa9760c },
        { label: 'Completed', value: stats.completed, color: 0x2c7a4b },
        { label: "Can't take up", value: stats.cantTakeup, color: 0xb3402f },
      ]
    : [];

  return (
    <AdminLayout>
      <div className="page-head">
        <div>
          <h1>Issue queue</h1>
          <p>Every complaint across every mandal, most recent first.</p>
        </div>
      </div>

      {stats && (
        <div className="grid-2" style={{ marginBottom: 28, alignItems: 'stretch' }}>
          <div className="stat-grid" style={{ marginBottom: 0 }}>
            <div className="stat-card"><div className="num">{stats.total}</div><div className="label">Total issues</div></div>
            <div className="stat-card"><div className="num">{stats.pending}</div><div className="label">Pending</div></div>
            <div className="stat-card accent"><div className="num">{stats.completed}</div><div className="label">Completed</div></div>
            <div className="stat-card"><div className="num">{stats.cantTakeup}</div><div className="label">Can't take up</div></div>
            <div className="stat-card"><div className="num">{stats.resolutionRate}%</div><div className="label">Resolution rate</div></div>
            <div className="stat-card"><div className="num">{stats.averageRating || '—'}</div><div className="label">Average rating</div></div>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: 4 }}>Status breakdown</h3>
            <p style={{ marginBottom: 8, fontSize: '0.82rem' }}>Pending · Completed · Can't take up</p>
            <ThreeStatBars data={barData} height={190} />
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Mandal</label>
            <select value={filters.mandalId} onChange={(e) => setFilters((f) => ({ ...f, mandalId: e.target.value }))}>
              <option value="">All mandals</option>
              {mandals.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Category</label>
            <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Status</label>
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Date</label>
            <input type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} />
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : issues.length === 0 ? (
        <div className="empty-state card"><h3>No issues match these filters</h3></div>
      ) : (
        issues.map((i) => (
          <Link key={i.id} to={`/admin/issues/${i.id}`} className="issue-row">
            <img className="issue-thumb" src={i.thumbnail ? `/uploads/${i.thumbnail}` : undefined} alt="" />
            <div>
              <div className="code">{i.issue_code}</div>
              <h4>{i.category}{i.reported_count > 1 ? ` · reported by ${i.reported_count}` : ''}</h4>
              <div className="meta">
                {i.citizen_name} · {i.mandal_name || 'Unassigned'} · {i.address} · {new Date(i.created_at).toLocaleDateString()}
                {i.ai_confidence != null && ` · AI confidence ${i.ai_confidence}%`}
              </div>
            </div>
            <StatusBadge status={i.status} />
          </Link>
        ))
      )}
    </AdminLayout>
  );
}
