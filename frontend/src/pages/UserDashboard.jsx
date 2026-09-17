import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import CitizenLayout from '../components/CitizenLayout.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function UserDashboard() {
  const { profile } = useAuth();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/issues/my').then((res) => {
      setIssues(res.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const total = issues.length;
  const pending = issues.filter((i) => i.status === 'PENDING' || i.status === 'AI_REVIEW').length;
  const completed = issues.filter((i) => i.status === 'COMPLETED').length;
  const cantTakeup = issues.filter((i) => i.status === 'CANT_TAKEUP').length;

  return (
    <CitizenLayout>
      <div className="page-head">
        <div>
          <h1>Hello, {profile?.name?.split(' ')[0]}</h1>
          <p>Here's a snapshot of what you've reported so far.</p>
        </div>
        <Link to="/report" className="btn btn-accent">+ Report new issue</Link>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="num">{total}</div><div className="label">Total complaints</div></div>
        <div className="stat-card"><div className="num">{pending}</div><div className="label">Pending</div></div>
        <div className="stat-card accent"><div className="num">{completed}</div><div className="label">Completed</div></div>
        <div className="stat-card"><div className="num">{cantTakeup}</div><div className="label">Can't take up</div></div>
      </div>

      <h2>Recent reports</h2>
      {loading ? (
        <p>Loading…</p>
      ) : issues.length === 0 ? (
        <div className="empty-state card">
          <h3>Nothing reported yet</h3>
          <p>When you see a pothole, leak, or garbage pile-up, report it here — it takes under a minute.</p>
          <Link to="/report" className="btn btn-primary">Report your first issue</Link>
        </div>
      ) : (
        issues.slice(0, 6).map((i) => (
          <Link key={i.id} to={`/my-issues/${i.id}`} className="issue-row">
            <img
              className="issue-thumb"
              src={i.thumbnail ? `/uploads/${i.thumbnail}` : undefined}
              alt=""
            />
            <div>
              <div className="code">{i.issue_code}</div>
              <h4>{i.category}</h4>
              <div className="meta">{i.mandal_name || 'Routing…'} · {new Date(i.created_at).toLocaleDateString()}</div>
            </div>
            <StatusBadge status={i.status} />
          </Link>
        ))
      )}
    </CitizenLayout>
  );
}
