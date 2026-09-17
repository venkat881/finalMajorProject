import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios.js';
import CitizenLayout from '../components/CitizenLayout.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const HISTORY_LABELS = {
  AI_REVIEW: 'AI verification',
  PENDING: 'Assigned to mandal',
  COMPLETED: 'Marked completed',
  CANT_TAKEUP: "Marked can't take up",
  DUPLICATE: 'Rejected by AI (matched an existing report)',
  REJECTED: 'Rejected — needs new photo',
};

export default function IssueDetails() {
  const { id } = useParams();
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ratingValue, setRatingValue] = useState(0);
  const [comment, setComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingError, setRatingError] = useState('');

  function load() {
    api.get(`/issues/${id}`).then((res) => {
      setIssue(res.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function submitRating() {
    setRatingError('');
    if (!ratingValue) return setRatingError('Please select a star rating');
    try {
      await api.post(`/issues/${id}/rating`, { rating: ratingValue, comment });
      setRatingSubmitted(true);
    } catch (err) {
      setRatingError(err.response?.data?.message || 'Failed to submit rating');
    }
  }

  if (loading) return <CitizenLayout><p>Loading…</p></CitizenLayout>;
  if (!issue) return <CitizenLayout><p>Issue not found.</p></CitizenLayout>;

  const canRate = issue.status === 'COMPLETED' && !issue.rating && !ratingSubmitted;

  return (
    <CitizenLayout>
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
            <h3>Details</h3>
            <p><strong>Description:</strong> {issue.description}</p>
            <p><strong>Address:</strong> {issue.address}{issue.landmark ? `, near ${issue.landmark}` : ''}</p>
            <p><strong>Mandal:</strong> {issue.mandal_name || 'Being determined'}</p>
            <p><strong>Reported:</strong> {new Date(issue.created_at).toLocaleString()}</p>
            {issue.status === 'CANT_TAKEUP' && issue.admin_reason && (
              <div className="error-banner">Reason this couldn't be taken up: {issue.admin_reason}</div>
            )}
            {issue.status === 'DUPLICATE' && issue.duplicateOfCode && (
              <div className="error-banner">
                Rejected by AI — this closely matches existing issue {issue.duplicateOfCode}
                {issue.duplicate_score != null ? ` (confidence: ${issue.duplicate_score}%)` : ''}.
              </div>
            )}
            {issue.images?.[0] && (
              <img
                src={`/uploads/${issue.images[0].image_path}`}
                alt="Reported issue"
                style={{ width: '100%', borderRadius: 8, marginTop: 10 }}
              />
            )}
          </div>

          {issue.status === 'COMPLETED' && (
            <div className="card">
              <h3>Rate this resolution</h3>
              {issue.rating || ratingSubmitted ? (
                <p>Thanks — you rated this {issue.rating?.rating || ratingValue} / 5.</p>
              ) : (
                <>
                  {ratingError && <div className="error-banner">{ratingError}</div>}
                  <div className="stars" style={{ marginBottom: 12 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={`star ${n <= ratingValue ? 'filled' : ''}`}
                        onClick={() => setRatingValue(n)}
                      >★</span>
                    ))}
                  </div>
                  <textarea
                    placeholder="Optional comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    style={{ marginBottom: 12 }}
                  />
                  <button className="btn btn-primary" onClick={submitRating}>Submit rating</button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Status history</h3>
          <ul className="timeline">
            {issue.history?.map((h) => (
              <li key={h.id}>
                <div className="t-time">{new Date(h.created_at).toLocaleString()}</div>
                <div className="t-label">{HISTORY_LABELS[h.new_status] || h.new_status}</div>
                {h.note && <div className="t-reason">{h.note}</div>}
                {h.reason && <div className="t-reason">Reason: {h.reason}</div>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </CitizenLayout>
  );
}
