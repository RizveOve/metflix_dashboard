import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useToast } from '../App';
import Icon from '../components/Icon';
import ShowResults, { Poster } from '../components/ShowResults';
import useTmdbSearch from '../lib/useTmdbSearch';
import { year } from '../lib/format';

function PastShows({ initialShow = null }) {
  const { showToast } = useToast();
  const search = useTmdbSearch('shows');
  const [selectedShow, setSelectedShow] = useState(initialShow);
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ message: '', percent: 0 });
  const pollRef = useRef(null);

  useEffect(() => () => clearTimeout(pollRef.current), []);

  const selectShow = (show) => {
    setSelectedShow(show);
    setSeasonNumber(1);
    search.clear();
  };

  const finish = () => {
    // Leave the final message visible briefly before resetting
    pollRef.current = setTimeout(() => {
      setDownloading(false);
      setProgress({ message: '', percent: 0 });
    }, 3000);
  };

  const downloadSeason = async () => {
    setDownloading(true);
    setProgress({ message: 'Starting…', percent: 0 });

    try {
      const response = await axios.post('/api/shows/download-season', {
        tmdbId: selectedShow.id,
        showName: selectedShow.name,
        season: seasonNumber,
        enableEpisodePriority: true // Always on for season downloads
      });

      if (!response.data.success || !response.data.sessionId) {
        showToast('Failed to start download', 'error');
        finish();
        return;
      }

      const sessionId = response.data.sessionId;
      const poll = async () => {
        try {
          const { data } = await axios.get(`/api/shows/download-progress/${sessionId}`);
          setProgress({ message: data.message || 'Working…', percent: data.progress || 0 });

          if (data.status === 'completed') {
            if (data.success) {
              const count = (data.downloads || []).length;
              showToast(count > 0 ? `Added ${count} downloads` : 'Download complete', 'success');
            } else {
              showToast(data.message || 'No high-quality release found', 'warning');
              if (data.qualityNote) showToast(data.qualityNote, 'info');
            }
            finish();
          } else if (data.status === 'error') {
            showToast(`Download failed: ${data.message}`, 'error');
            finish();
          } else if (data.status === 'searching' || data.status === 'downloading') {
            pollRef.current = setTimeout(poll, 2000);
          } else {
            finish();
          }
        } catch (error) {
          console.error('Error polling progress:', error);
          showToast('Lost track of download progress', 'warning');
          finish();
        }
      };
      pollRef.current = setTimeout(poll, 1000);
    } catch (error) {
      showToast('Error starting download: ' + (error.response?.data?.error || error.message), 'error');
      finish();
    }
  };

  return (
    <>
      {!selectedShow ? (
        <ShowResults search={search} placeholder="Search TV shows…" onPick={selectShow} />
      ) : (
        <div className="card selected-show">
          <div className="selected-show-info">
            <Poster path={selectedShow.posterPath} alt={selectedShow.name} size="w154" className="poster-lg" />
            <div className="row-main">
              <h2 className="selected-title">{selectedShow.name}</h2>
              <div className="row-meta">
                {year(selectedShow.firstAirDate) && <span>{year(selectedShow.firstAirDate)}</span>}
                {selectedShow.voteAverage > 0 && <span>★ {selectedShow.voteAverage.toFixed(1)}</span>}
              </div>
              {selectedShow.overview && <p className="row-desc clamp-3">{selectedShow.overview}</p>}
            </div>
          </div>

          <div className="season-picker">
            <span className="field-label">Season</span>
            <div className="stepper">
              <button className="icon-btn" onClick={() => setSeasonNumber(Math.max(1, seasonNumber - 1))}
                disabled={seasonNumber <= 1 || downloading} aria-label="Previous season">
                <Icon name="minus" size={16} />
              </button>
              <span className="stepper-value">{seasonNumber}</span>
              <button className="icon-btn" onClick={() => setSeasonNumber(Math.min(20, seasonNumber + 1))}
                disabled={seasonNumber >= 20 || downloading} aria-label="Next season">
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>

          {downloading && (
            <div className="season-progress">
              <div className="season-progress-text">
                <span>{progress.message}</span>
                <span className="muted">{Math.round(progress.percent)}%</span>
              </div>
              <div className="progress"><div className="progress-fill tone-active" style={{ width: `${progress.percent}%` }} /></div>
            </div>
          )}

          <div className="panel-actions">
            <button className="btn" onClick={() => setSelectedShow(null)} disabled={downloading}>Back</button>
            <button className="btn btn-primary" onClick={downloadSeason} disabled={downloading}>
              {downloading ? <span className="spinner" /> : <><Icon name="download" size={16} /> Download season {seasonNumber}</>}
            </button>
          </div>
        </div>
      )}

      <p className="footnote">
        Looks for a complete season pack first, then single episodes. Only 1080p or better (4K WEB-DL → 1080p WEB-DL → 4K → 1080p), most seeders wins. Needs 5 GB free.
      </p>
    </>
  );
}

export default PastShows;
