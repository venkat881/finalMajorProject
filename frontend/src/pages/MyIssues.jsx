import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import CitizenLayout from '../components/CitizenLayout.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANT_TAKEUP', label: "Can't take up" },
];

export default function MyIssues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ALL');

  useEffect(() => {
    api.get('/issues/my').then((res) => {
      setIssues(res.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = issues.filter((i) => {
    if (tab === 'ALL') return true;
    if (tab === 'PENDING') return i.status === 'PENDING' || i.status === 'AI_REVIEW';
    return i.status === tab;
  });

  return (
    <CitizenLayout>
      <div className="page-head">
        <div>
          <h1>My issues</h1>
          <p>Track every complaint you've submitted, from AI review to resolution.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'btn btn-primary' : 'btn btn-outline'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state card"><h3>No issues in this view</h3></div>
      ) : (
        filtered.map((i) => (
          <Link key={i.id} to={`/my-issues/${i.id}`} className="issue-row">
            <img className="issue-thumb" src={i.thumbnail ? `/uploads/${i.thumbnail}` : undefined} alt="" />
            <div>
              <div className="code">{i.issue_code}</div>
              <h4>{i.category}</h4>
              <div className="meta">
                {i.mandal_name || 'Routing…'} · {i.address} · {new Date(i.created_at).toLocaleDateString()}
              </div>
              {i.status === 'CANT_TAKEUP' && i.admin_reason && (
                <div className="meta" style={{ color: 'var(--danger)' }}>Reason: {i.admin_reason}</div>
              )}
            </div>
            <StatusBadge status={i.status} />
          </Link>
        ))
      )}
    </CitizenLayout>
  );
}
