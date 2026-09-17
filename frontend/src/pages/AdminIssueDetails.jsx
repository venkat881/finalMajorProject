import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import AdminLayout from '../components/AdminLayout.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminIssueDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [showReasonBox, setShowReasonBox] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  function load() {
    api.get(`/admin/issues/${id}`).then((res) => {
      setIssue(res.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(load, [id]);

  async function markCompleted() {
    setActionLoading(true);
    setActionError('');
    try {
      await api.put(`/admin/issues/${id}/status`, { status: 'COMPLETED' });
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  }

  async function markCantTakeup() {
    if (!reason.trim() || reason.trim().length < 5) {
      setActionError('A reason of at least a few words is required');
      return;
    }
    setActionLoading(true);
    setActionError('');
    try {
      await api.put(`/admin/issues/${id}/status`, { status: 'CANT_TAKEUP', reason: reason.trim() });
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <AdminLayout><p>Loading…</p></AdminLayout>;
  if (!issue) return <AdminLayout><p>Issue not found.</p></AdminLayout>;

  const isOwnMandal = issue.mandal_id === profile?.mandalId;
  const canAct = issue.status === 'PENDING' && isOwnMandal;

  return (
    <AdminLayout>
      <div className="page-head">
        <div>
          <div className="code">{issue.issue_code}</div>
          <h1>{issue.category}</h1>
        </div>
        <StatusBadge status={issue.status} />
      </div>

      <div className="grid-2">
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3>Complaint details</h3>
            <p><strong>Citizen:</strong> {issue.citizen_name} · {issue.citizen_phone}</p>
            <p><strong>Mandal:</strong> {issue.mandal_name || 'Unassigned'}</p>
            <p><strong>Description:</strong> {issue.description}</p>
            <p><strong>Address:</strong> {issue.address}{issue.landmark ? `, near ${issue.landmark}` : ''}</p>
            <p><strong>Coordinates:</strong> {issue.latitude}, {issue.longitude}</p>
            <p><strong>Submitted:</strong> {new Date(issue.created_at).toLocaleString()}</p>
            {issue.images?.[0] && (
              <img src={`/uploads/${issue.images[0].image_path}`} alt="Reported issue" style={{ width: '100%', borderRadius: 8, marginTop: 10 }} />
            )}
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h3>AI &amp; duplicate signal</h3>
            <p><strong>AI detected category:</strong> {issue.ai_category || '—'}</p>
            <p><strong>AI confidence:</strong> {issue.ai_confidence != null ? `${issue.ai_confidence}%` : '—'}</p>
            <p><strong>Duplicate score:</strong> {issue.duplicate_score != null ? `${issue.duplicate_score}%` : '—'}</p>
            {issue.linkedReports?.length > 0 && (
              <p><strong>Also reported by:</strong> {issue.linkedReports.length} other citizen(s)</p>
            )}
          </div>

          {canAct && (
            <div className="card">
              <h3>Take action</h3>
              {actionError && <div className="error-banner">{actionError}</div>}
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <button className="btn btn-primary" onClick={markCompleted} disabled={actionLoading}>
                  Mark completed
                </button>
                <button className="btn btn-outline" onClick={() => setShowReasonBox((s) => !s)} disabled={actionLoading}>
                  Can't take up
                </button>
              </div>
              {showReasonBox && (
                <div className="field">
                  <label>Reason (required)</label>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Outside municipal jurisdiction" />
                  <button className="btn btn-danger" style={{ marginTop: 8 }} onClick={markCantTakeup} disabled={actionLoading}>
                    Confirm can't take up
                  </button>
                </div>
              )}
            </div>
          )}

          {issue.status === 'PENDING' && !isOwnMandal && (
            <div className="info-banner">
              This issue belongs to {issue.mandal_name || 'another mandal'} — only that mandal's admin account can mark it completed or can't-take-up. You can still view it here as part of the unified queue.
            </div>
          )}

          {issue.status === 'CANT_TAKEUP' && (
            <div className="error-banner">Reason given: {issue.admin_reason}</div>
          )}
        </div>

        <div className="card">
          <h3>Status history</h3>
          <ul className="timeline">
            {issue.history?.map((h) => (
              <li key={h.id}>
                <div className="t-time">{new Date(h.created_at).toLocaleString()}</div>
                <div className="t-label">{h.new_status}{h.admin_name ? ` — ${h.admin_name}` : ''}</div>
                {h.note && <div className="t-reason">{h.note}</div>}
                {h.reason && <div className="t-reason">Reason: {h.reason}</div>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}
