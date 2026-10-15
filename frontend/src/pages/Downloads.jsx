import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../App';
import Icon from '../components/Icon';
import ConfirmModal from '../components/ConfirmModal';
import {
  formatSize, formatSpeed, formatEta, statusText, statusTone,
  isActive, isPaused, optimisticState,
} from '../lib/format';

// Active downloads first, then unfinished, then completed
const sortTorrents = (list) =>
  [...list].sort((a, b) => {
    if (isActive(a) !== isActive(b)) return isActive(a) ? -1 : 1;
    if ((a.progress < 1) !== (b.progress < 1)) return a.progress < 1 ? -1 : 1;
    return 0;
  });

function Downloads() {
  const { showToast } = useToast();
  const [torrents, setTorrents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchTorrents = useCallback(async () => {
    try {
      const response = await axios.get('/api/qbittorrent/torrents');
      setTorrents(response.data);
      setError(null);
    } catch (error) {
      console.error('Error fetching torrents:', error);
      setError(error.response?.data?.error || error.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTorrents();
    const interval = setInterval(fetchTorrents, 5000);
    return () => clearInterval(interval);
  }, [fetchTorrents]);

  // Run a pause/resume/delete on one or more hashes, updating the list optimistically
  const runAction = async (action, hashList) => {
    const hashSet = new Set(hashList);
    if (action === 'pause' || action === 'resume') {
      setTorrents(prev => prev.map(t => hashSet.has(t.hash)
        ? { ...t, state: optimisticState(t, action), dlspeed: action === 'pause' ? 0 : t.dlspeed, upspeed: action === 'pause' ? 0 : t.upspeed }
        : t));
    }

    try {
      await axios.post(`/api/qbittorrent/torrents/${action}`, {
        hashes: hashList.join('|'),
        deleteFiles: true
      });
      const verb = { pause: 'paused', resume: 'resumed', delete: 'removed' }[action];
      showToast(hashList.length > 1 ? `${hashList.length} torrents ${verb}` : `Torrent ${verb}`, 'success');
      // Give qBittorrent time to apply the change before refreshing
      setTimeout(fetchTorrents, 1500);
    } catch (error) {
      fetchTorrents();
      showToast('Error: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const toggleSelect = (hash) => {
    const next = new Set(selected);
    next.has(hash) ? next.delete(hash) : next.add(hash);
    setSelected(next);
  };

  const exitSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const bulk = (action) => {
    const hashes = Array.from(selected);
    if (action === 'delete') {
      setConfirmDelete({ hashes, count: hashes.length });
      return;
    }
    runAction(action, hashes);
    exitSelecting();
  };

  const sorted = sortTorrents(torrents);
  const totalDown = torrents.reduce((sum, t) => sum + (t.dlspeed || 0), 0);
  const totalUp = torrents.reduce((sum, t) => sum + (t.upspeed || 0), 0);

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1>Downloads</h1>
          {torrents.length > 0 && (
            <p className="page-sub">
              <span className="nowrap">{torrents.length} torrent{torrents.length === 1 ? '' : 's'}</span>
              <span className="sep">·</span><span className="nowrap">↓ {formatSpeed(totalDown)}</span>
              <span className="sep">·</span><span className="nowrap">↑ {formatSpeed(totalUp)}</span>
            </p>
          )}
        </div>
        <div className="head-actions">
          {torrents.length > 0 && (
            <button className="btn btn-ghost" onClick={() => (selecting ? exitSelecting() : setSelecting(true))}>
              {selecting ? 'Done' : 'Select'}
            </button>
          )}
          <Link to="/search" className="btn btn-primary">
            <Icon name="plus" size={16} /> Add
          </Link>
        </div>
      </div>

      {error && (
        <div className="banner banner-error">
          <Icon name="alert" size={16} />
          <div>
            <strong>Can't reach qBittorrent.</strong> {error}
          </div>
        </div>
      )}

      {loading ? (
        <div className="list">
          {[0, 1, 2].map(i => <div key={i} className="row skeleton" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty">
          <Icon name="download" size={28} />
          <h2>No downloads</h2>
          <p>Search for something to download, or add a magnet link.</p>
          <Link to="/search" className="btn btn-primary">Find something</Link>
        </div>
      ) : (
        <div className="list">
          {sorted.map(t => {
            const tone = statusTone(t);
            const paused = isPaused(t);
            const isSel = selected.has(t.hash);
            const pct = (t.progress * 100).toFixed(t.progress >= 1 ? 0 : 1);
            return (
              <div
                key={t.hash}
                className={`row torrent ${selecting ? 'is-selectable' : ''} ${isSel ? 'is-selected' : ''}`}
                onClick={selecting ? () => toggleSelect(t.hash) : undefined}
              >
                {selecting && (
                  <span className={`checkbox ${isSel ? 'on' : ''}`} aria-hidden="true">
                    {isSel && <Icon name="check" size={12} />}
                  </span>
                )}
                <div className="row-main">
                  <div className="row-title">{t.name}</div>
                  <div className="progress"><div className={`progress-fill tone-${tone}`} style={{ width: `${pct}%` }} /></div>
                  <div className="row-meta">
                    <span className={`status tone-${tone}`}>{statusText(t.state)}</span>
                    <span>{formatSize(t.size)}</span>
                    {t.progress < 1 && <span>{pct}%</span>}
                    {t.progress < 1 && t.eta > 0 && t.eta < 8640000 && <span>{formatEta(t.eta)} left</span>}
                    {t.dlspeed > 0 && <span className="speed-down">↓ {formatSpeed(t.dlspeed)}</span>}
                    {t.upspeed > 0 && <span className="speed-up">↑ {formatSpeed(t.upspeed)}</span>}
                    {t.episodePriorityEnabled && <span className="tag">Episodes first</span>}
                  </div>
                </div>
                {!selecting && (
                  <div className="row-actions">
                    <button
                      className="icon-btn"
                      onClick={() => runAction(paused ? 'resume' : 'pause', [t.hash])}
                      aria-label={paused ? 'Resume' : 'Pause'}
                      title={paused ? 'Resume' : 'Pause'}
                    >
                      <Icon name={paused ? 'play' : 'pause'} size={16} />
                    </button>
                    <button
                      className="icon-btn icon-btn-danger"
                      onClick={() => setConfirmDelete({ hashes: [t.hash], name: t.name })}
                      aria-label="Remove"
                      title="Remove"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selecting && (
        <div className="bulk-bar">
          <span className="bulk-count">{selected.size} selected</span>
          <button className="btn btn-ghost" disabled={!selected.size} onClick={() => bulk('resume')}>
            <Icon name="play" size={14} /> Resume
          </button>
          <button className="btn btn-ghost" disabled={!selected.size} onClick={() => bulk('pause')}>
            <Icon name="pause" size={14} /> Pause
          </button>
          <button className="btn btn-danger" disabled={!selected.size} onClick={() => bulk('delete')}>
            <Icon name="trash" size={14} /> Remove
          </button>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Remove torrent"
          message={confirmDelete.name
            ? `Remove "${confirmDelete.name}"? This also deletes the downloaded files.`
            : `Remove ${confirmDelete.count} torrents? This also deletes the downloaded files.`}
          confirmText="Remove"
          onConfirm={() => {
            runAction('delete', confirmDelete.hashes);
            setConfirmDelete(null);
            exitSelecting();
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

export default Downloads;
