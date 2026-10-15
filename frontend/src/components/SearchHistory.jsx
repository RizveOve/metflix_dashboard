import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Sheet from './Sheet';
import Icon from './Icon';

const formatDuration = (ms) => {
  if (!ms) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
};

const STATUS_TONE = { completed: 'done', running: 'active', started: 'active', failed: 'error' };

function SearchHistory({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/qbittorrent/search/logs?limit=50');
      setLogs(response.data.logs || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Error fetching search logs:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const clearLogs = async () => {
    // Two-step: first tap arms, second tap clears
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    try {
      await axios.delete('/api/qbittorrent/search/logs');
      setLogs([]);
      setTotal(0);
    } catch (error) {
      console.error('Error clearing logs:', error);
    }
    setConfirmClear(false);
  };

  return (
    <Sheet
      title="Search history"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={fetchLogs}><Icon name="refresh" size={14} /> Refresh</button>
          <button className="btn btn-danger" onClick={clearLogs} disabled={!logs.length}>
            {confirmClear ? 'Tap again to clear' : 'Clear all'}
          </button>
        </>
      }
    >
      {loading && !logs.length ? (
        <div className="searching"><span className="spinner" /> Loading…</div>
      ) : logs.length === 0 ? (
        <p className="muted center">No searches yet.</p>
      ) : (
        <>
          <div className="list list-flush">
            {logs.map(log => (
              <div key={log.id} className="row">
                <div className="row-main">
                  <div className="row-title">{log.pattern}</div>
                  <div className="row-meta">
                    <span className={`status tone-${STATUS_TONE[log.status] || 'idle'}`}>{log.status}</span>
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                    <span>{log.resultCount || 0} results</span>
                    {formatDuration(log.duration) && <span>{formatDuration(log.duration)}</span>}
                  </div>
                  {log.error && <div className="row-error">{log.error}</div>}
                </div>
              </div>
            ))}
          </div>
          {total > logs.length && (
            <p className="muted center small">Showing {logs.length} of {total}</p>
          )}
        </>
      )}
    </Sheet>
  );
}

export default SearchHistory;
