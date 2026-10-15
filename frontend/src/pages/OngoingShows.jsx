import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../App';
import Icon from '../components/Icon';
import Sheet from '../components/Sheet';
import ConfirmModal from '../components/ConfirmModal';
import QueueSheet from '../components/QueueSheet';
import ShowResults from '../components/ShowResults';
import useTmdbSearch from '../lib/useTmdbSearch';
import { episodeCode } from '../lib/format';

function OngoingShows() {
  const { showToast } = useToast();
  const search = useTmdbSearch('shows');
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState(null);
  const [checking, setChecking] = useState(false);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(false);
  const [queueStatus, setQueueStatus] = useState(null);
  const [showQueue, setShowQueue] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [seasonForm, setSeasonForm] = useState(null); // { show, start, end }
  const [downloadingSeason, setDownloadingSeason] = useState(false);

  const fetchShows = useCallback(async () => {
    try {
      const response = await axios.get('/api/shows');
      setShows(response.data.shows || []);
    } catch (error) {
      console.error('Error fetching shows:', error);
      showToast('Error loading shows: ' + error.message, 'error');
    }
    setLoading(false);
  }, [showToast]);

  const fetchQueueStatus = useCallback(async () => {
    try {
      const response = await axios.get('/api/shows/queue/status');
      setQueueStatus(response.data);
    } catch (error) {
      console.error('Error fetching queue status:', error);
    }
  }, []);

  useEffect(() => {
    fetchShows();
    axios.get('/api/shows/config/auto-check')
      .then(res => setAutoCheckEnabled(res.data.enabled))
      .catch(error => console.error('Error fetching auto-check status:', error));
  }, [fetchShows]);

  // Poll the queue faster while its sheet is open
  useEffect(() => {
    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, showQueue ? 5000 : 30000);
    return () => clearInterval(interval);
  }, [fetchQueueStatus, showQueue]);

  const addShow = async (show) => {
    setAddingId(show.id);
    try {
      const response = await axios.post('/api/shows', {
        tmdbId: show.id,
        name: show.name,
        currentSeason: 1,
        currentEpisode: 0
      });
      search.clear();
      fetchShows();
      fetchQueueStatus();
      showToast(response.data.catchUpEpisodes > 0
        ? `Tracking ${show.name}. Caught up on ${response.data.catchUpEpisodes} episodes.`
        : `Tracking ${show.name}`, 'success');
    } catch (error) {
      showToast('Error adding show: ' + (error.response?.data?.error || error.message), 'error');
    }
    setAddingId(null);
  };

  const removeShow = async (id) => {
    try {
      await axios.delete(`/api/shows/${id}`);
      fetchShows();
      showToast('Show removed', 'success');
    } catch (error) {
      showToast('Error removing show: ' + error.message, 'error');
    }
  };

  const toggleShowStatus = async (show) => {
    const status = show.status === 'active' ? 'paused' : 'active';
    try {
      await axios.put(`/api/shows/${show.id}`, { status });
      fetchShows();
      showToast(status === 'active' ? `Resumed ${show.name}` : `Paused ${show.name}`, 'success');
    } catch (error) {
      showToast('Error updating show: ' + error.message, 'error');
    }
  };

  const checkForNewEpisodes = async () => {
    setChecking(true);
    try {
      const response = await axios.post('/api/shows/check');
      if (response.data.success) {
        const downloads = response.data.downloads || [];
        showToast(downloads.length > 0 ? `Found ${downloads.length} new episodes` : 'No new episodes yet', downloads.length > 0 ? 'success' : 'info');
        fetchShows();
        fetchQueueStatus();
      } else {
        showToast(response.data.message || 'Check failed', 'error');
      }
    } catch (error) {
      showToast('Error checking for episodes: ' + error.message, 'error');
    }
    setChecking(false);
  };

  const toggleAutoCheck = async () => {
    try {
      const response = await axios.post('/api/shows/config/auto-check', { enabled: !autoCheckEnabled });
      if (response.data.success) {
        setAutoCheckEnabled(!autoCheckEnabled);
        showToast(response.data.message, 'success');
      }
    } catch (error) {
      showToast('Error toggling auto-check: ' + error.message, 'error');
    }
  };

  const clearQueue = async () => {
    try {
      const response = await axios.post('/api/shows/queue/clear');
      if (response.data.success) {
        showToast(`Cleared ${response.data.clearedCount} items`, 'success');
        fetchQueueStatus();
      }
    } catch (error) {
      showToast('Error clearing queue: ' + error.message, 'error');
    }
  };

  const downloadSeason = async () => {
    const { show, start, end } = seasonForm;
    setDownloadingSeason(true);
    try {
      const response = await axios.post(`/api/shows/${show.id}/season/${show.currentSeason}`, {
        startEpisode: parseInt(start),
        endEpisode: parseInt(end)
      });
      if (response.data.success) {
        showToast(`Downloading ${(response.data.downloads || []).length} episodes`, 'success');
        setSeasonForm(null);
      } else {
        showToast(response.data.message || 'Download failed', 'error');
      }
    } catch (error) {
      showToast('Error downloading season: ' + error.message, 'error');
    }
    setDownloadingSeason(false);
  };

  const queued = queueStatus?.queueLength || 0;
  const trackedIds = new Set(shows.map(s => s.tmdbId));

  return (
    <>
      <div className="list">
        <div className="row setting-row">
          <div className="row-main">
            <div className="row-title">Auto-check new episodes</div>
            <div className="row-meta"><span>Searches about an hour after each episode airs</span></div>
          </div>
          <button
            className={`switch ${autoCheckEnabled ? 'on' : ''}`}
            role="switch"
            aria-checked={autoCheckEnabled}
            aria-label="Auto-check new episodes"
            onClick={toggleAutoCheck}
          />
        </div>
        <button className="row setting-row row-button" onClick={() => setShowQueue(true)}>
          <div className="row-main">
            <div className="row-title">Search queue</div>
            <div className="row-meta">
              <span>{queueStatus ? (queued > 0 ? `${queued} pending` : 'Empty') : 'Loading…'}</span>
              {queueStatus?.processing && queueStatus.nextSearchIn > 0 && (
                <span>Next in {Math.round(queueStatus.nextSearchIn / 1000)}s</span>
              )}
            </div>
          </div>
          <Icon name="list" size={18} className="muted" />
        </button>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Add a show</h2>
        </div>
        <ShowResults
          search={search}
          placeholder="Search TV shows to track…"
          renderAction={(show) => trackedIds.has(show.id) ? (
            <span className="tag">Tracking</span>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => addShow(show)} disabled={addingId !== null}>
              {addingId === show.id ? <span className="spinner" /> : <><Icon name="plus" size={14} /> Track</>}
            </button>
          )}
        />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Tracked{shows.length > 0 && <span className="count">{shows.length}</span>}</h2>
          {shows.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={checkForNewEpisodes} disabled={checking}>
              {checking ? <span className="spinner" /> : <Icon name="refresh" size={14} />} Check now
            </button>
          )}
        </div>

        {loading ? (
          <div className="list"><div className="row skeleton" /><div className="row skeleton" /></div>
        ) : shows.length === 0 ? (
          <div className="empty empty-sm">
            <p>No shows tracked yet. Search above to add one.</p>
          </div>
        ) : (
          <div className="list">
            {shows.map(show => (
              <div key={show.id} className="row">
                <div className="row-main">
                  <div className="row-title">{show.name}</div>
                  <div className="row-meta">
                    <span>{episodeCode(show.currentSeason, show.currentEpisode)}</span>
                    <span className={`status tone-${show.status === 'active' ? 'done' : 'paused'}`}>
                      {show.status === 'active' ? 'Active' : 'Paused'}
                    </span>
                    {show.nextEpisodeAirDate && <span>Next {new Date(show.nextEpisodeAirDate).toLocaleDateString()}</span>}
                    {show.downloadedEpisodes?.length > 0 && <span>{show.downloadedEpisodes.length} downloaded</span>}
                  </div>
                </div>
                <div className="row-actions">
                  <button
                    className="icon-btn"
                    title={`Download season ${show.currentSeason}`}
                    aria-label={`Download season ${show.currentSeason}`}
                    onClick={() => setSeasonForm({ show, start: '1', end: '24' })}
                  >
                    <Icon name="download" size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    title={show.status === 'active' ? 'Pause tracking' : 'Resume tracking'}
                    aria-label={show.status === 'active' ? 'Pause tracking' : 'Resume tracking'}
                    onClick={() => toggleShowStatus(show)}
                  >
                    <Icon name={show.status === 'active' ? 'pause' : 'play'} size={16} />
                  </button>
                  <button
                    className="icon-btn icon-btn-danger"
                    title="Stop tracking"
                    aria-label="Stop tracking"
                    onClick={() => setConfirmRemove(show)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="footnote">
          Picks 4K WEB-DL, then 1080p WEB-DL, then whatever is available, choosing the release with the most seeders. Only downloads while at least 5 GB is free.
        </p>
      </section>

      {showQueue && (
        <QueueSheet status={queueStatus} onClear={clearQueue} onClose={() => setShowQueue(false)} />
      )}

      {confirmRemove && (
        <ConfirmModal
          title="Stop tracking"
          message={`Stop tracking ${confirmRemove.name}? Episodes already downloaded stay where they are.`}
          confirmText="Stop tracking"
          onConfirm={() => { removeShow(confirmRemove.id); setConfirmRemove(null); }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {seasonForm && (
        <Sheet
          title={`${seasonForm.show.name} · Season ${seasonForm.show.currentSeason}`}
          onClose={() => setSeasonForm(null)}
          footer={
            <>
              <button className="btn" onClick={() => setSeasonForm(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={downloadSeason} disabled={downloadingSeason || !seasonForm.start || !seasonForm.end}>
                {downloadingSeason ? <span className="spinner" /> : 'Download'}
              </button>
            </>
          }
        >
          <p className="muted">Choose which episodes to download.</p>
          <div className="field-row">
            <label className="field">
              <span>From episode</span>
              <input className="input" type="number" min="1" value={seasonForm.start}
                onChange={(e) => setSeasonForm({ ...seasonForm, start: e.target.value })} />
            </label>
            <label className="field">
              <span>To episode</span>
              <input className="input" type="number" min="1" value={seasonForm.end}
                onChange={(e) => setSeasonForm({ ...seasonForm, end: e.target.value })} />
            </label>
          </div>
        </Sheet>
      )}
    </>
  );
}

export default OngoingShows;
