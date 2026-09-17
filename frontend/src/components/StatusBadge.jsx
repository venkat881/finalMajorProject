const CONFIG = {
  PENDING:     { label: 'Pending',        cls: 'badge-pending' },
  AI_REVIEW:   { label: 'Under review',   cls: 'badge-review' },
  COMPLETED:   { label: 'Completed',      cls: 'badge-completed' },
  CANT_TAKEUP: { label: "Can't take up",  cls: 'badge-cant' },
  DUPLICATE:   { label: 'Rejected by AI', cls: 'badge-rejected' },
  REJECTED:    { label: 'Needs new photo', cls: 'badge-rejected' },
};

export default function StatusBadge({ status }) {
  const c = CONFIG[status] || { label: status, cls: 'badge-review' };
  return <span className={`badge ${c.cls}`}>{c.label}</span>;
}
