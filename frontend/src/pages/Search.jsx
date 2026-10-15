import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../App';
import Icon from '../components/Icon';
import SearchHistory from '../components/SearchHistory';
import { formatSize } from '../lib/format';

const SORTS = [
  { key: 'seeders', label: 'Seeders' },
  { key: 'size', label: 'Size' },
  { key: 'name', label: 'Name' },
];

const loadRecent = () => {
  try {
    return JSON.parse(localStorage.getItem('recentSearches')) || [];
  } catch {
    return [];
  }
};

const hostname = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

const seedTone = (seeders) => (seeders > 50 ? 'good' : seeders > 10 ? 'ok' : 'low');

function Search() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [foundSoFar, setFoundSoFar] = useState(0);
  const [selected, setSelected] = useState(null);
  const [recentSearches, setRecentSearches] = useState(loadRecent);
  const [sortBy, setSortBy] = useState('seeders');
  const [episodePriority, setEpisodePriority] = useState(true);
  const [adding, setAdding] = useState(false);
  const [magnet, setMagnet] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const pollRef = useRef(null);

  // Stop polling if the page is left mid-search
  useEffect(() => () => clearInterval(pollRef.current), []);

  const saveRecentSearch = (query) => {
    const updated = [query, ...recentSearches.filter(q => q !== query)].slice(0, 5);
    setRecentSearches(updated);
    try {
      localStorage.setItem('recentSearches', JSON.stringify(updated));
    } catch {
      // storage unavailable; recent searches just won't persist
    }
  };

  const finish = () => {
    clearInterval(pollRef.current);
    setSearching(false);
  };

  const stopSearch = (id) => axios.post('/api/qbittorrent/search/stop', { id }).catch(() => {});

  const searchTorrents = async (query = searchQuery) => {
    if (!query.trim()) {
      showToast('Type something to search for', 'warning');
      return;
    }

    clearInterval(pollRef.current);
    setSearching(true);
    setSearchResults([]);
    setSelected(null);
    setFoundSoFar(0);
    saveRecentSearch(query);

    try {
      const response = await axios.post('/api/qbittorrent/search/start', {
        pattern: query,
        plugins: 'enabled',
        category: 'all'
      });
      const searchJobId = response.data.id;

      let pollCount = 0;
      const maxPolls = 30;
      let lastTotal = 0;
      let stableCount = 0;

      // Poll until qBittorrent stops, or the result count holds steady for 3s
      pollRef.current = setInterval(async () => {
        try {
          pollCount++;
          const status = await axios.get(`/api/qbittorrent/search/status/${searchJobId}`);

          if (status.data && status.data.length > 0) {
            const { status: statusStr, total = 0 } = status.data[0];
            setFoundSoFar(total);
            stableCount = total > 0 && total === lastTotal ? stableCount + 1 : 0;
            lastTotal = total;

            if ((statusStr === 'Stopped' && total > 0) || (total > 0 && stableCount >= 3)) {
              const results = await axios.get(`/api/qbittorrent/search/results/${searchJobId}?limit=200`);
              if (results.data?.results?.length > 0) {
                finish();
                setSearchResults(results.data.results);
                stopSearch(searchJobId);
                return;
              }
            } else if (statusStr === 'Stopped' && total === 0) {
              finish();
              showToast('No results. Try different keywords.', 'warning');
              return;
            }
          }

          if (pollCount >= maxPolls) {
            finish();
            try {
              const results = await axios.get(`/api/qbittorrent/search/results/${searchJobId}?limit=200`);
              if (results.data?.results?.length > 0) {
                setSearchResults(results.data.results);
              } else {
                showToast('Search timed out with no results', 'warning');
              }
            } catch {
              showToast('Search timed out', 'error');
            }
            stopSearch(searchJobId);
          }
        } catch (err) {
          console.error('Error during search:', err);
          finish();
          showToast('Search failed: ' + (err.response?.data?.error || err.message), 'error');
        }
      }, 1000);
    } catch (error) {
      showToast('Error starting search: ' + (error.response?.data?.error || error.message), 'error');
      setSearching(false);
    }
  };

  const addSearchedTorrent = async () => {
    const url = selected?.fileUrl;
    if (!url || !(url.startsWith('magnet:') || url.endsWith('.torrent'))) {
      showToast('No valid download link for this result', 'error');
      return;
    }

    setAdding(true);
    try {
      await axios.post('/api/qbittorrent/torrents/add-advanced', {
        urls: url,
        enableEpisodePriority: episodePriority
      });
      showToast('Added to downloads', 'success');
      setTimeout(() => navigate('/'), 800);
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      const details = error.response?.data?.details;
      showToast('Error: ' + errorMsg + (details ? ' - ' + details : ''), 'error');
    }
    setAdding(false);
  };

  const addMagnet = async () => {
    if (!magnet.trim()) {
      showToast('Paste a magnet link or torrent URL', 'warning');
      return;
    }
    try {
      await axios.post('/api/qbittorrent/torrents/add', { urls: magnet });
      setMagnet('');
      showToast('Added to downloads', 'success');
      setTimeout(() => navigate('/'), 800);
    } catch (error) {
      showToast('Error adding torrent: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  // Only results qBittorrent can actually add
  const results = searchResults
    .filter(r => r.fileUrl && (r.fileUrl.startsWith('magnet:') || r.fileUrl.endsWith('.torrent')))
    .sort((a, b) => {
      if (sortBy === 'size') return b.fileSize - a.fileSize;
      if (sortBy === 'name') return a.fileName.localeCompare(b.fileName);
      return b.nbSeeders - a.nbSeeders;
    });

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1>Search</h1>
          <p className="page-sub">Movies, shows, anything. Searches all installed sources.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-ghost" onClick={() => setShowHistory(true)}>
            <Icon name="history" size={16} /> History
          </button>
        </div>
      </div>

      <form
        className="search-bar"
        onSubmit={(e) => { e.preventDefault(); searchTorrents(); }}
      >
        <div className="input-wrap">
          <Icon name="search" size={18} className="input-icon" />
          <input
            className="input input-with-icon"
            type="search"
            placeholder="Breaking Bad, The Matrix…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            enterKeyHint="search"
          />
        </div>
        <button className="btn btn-primary btn-lg" type="submit" disabled={searching}>
          {searching ? <span className="spinner" /> : 'Search'}
        </button>
      </form>

      {recentSearches.length > 0 && !searching && searchResults.length === 0 && (
        <div className="chips">
          <span className="chips-label">Recent</span>
          {recentSearches.map(query => (
            <button
              key={query}
              className="chip"
              onClick={() => { setSearchQuery(query); searchTorrents(query); }}
            >
              {query}
            </button>
          ))}
        </div>
      )}

      {searching && (
        <div className="searching">
          <span className="spinner" />
          Searching sources… {foundSoFar > 0 && <span className="muted">{foundSoFar} found so far</span>}
        </div>
      )}

      {results.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{results.length} results</h2>
            <div className="seg" role="tablist">
              {SORTS.map(s => (
                <button
                  key={s.key}
                  role="tab"
                  aria-selected={sortBy === s.key}
                  className={sortBy === s.key ? 'active' : ''}
                  onClick={() => setSortBy(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="list">
            {results.map((r, i) => {
              const isSel = selected === r;
              const site = hostname(r.siteUrl);
              return (
                <div key={`${r.fileUrl}-${i}`} className={`row result ${isSel ? 'is-open' : ''}`}>
                  <button className="row-button" onClick={() => setSelected(isSel ? null : r)}>
                    <div className="row-main">
                      <div className="row-title">{r.fileName}</div>
                      <div className="row-meta">
                        <span>{formatSize(r.fileSize)}</span>
                        <span className={`seeds seeds-${seedTone(r.nbSeeders)}`}>
                          <span className="dot" /> {r.nbSeeders} {r.nbSeeders === 1 ? 'seeder' : 'seeders'}
                        </span>
                        {site && <span>{site}</span>}
                      </div>
                    </div>
                  </button>

                  {isSel && (
                    <div className="result-panel">
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={episodePriority}
                          onChange={(e) => setEpisodePriority(e.target.checked)}
                        />
                        <span>
                          Download episodes in order
                          <small>For TV packs, starts with S01E01. Sequential download is always on.</small>
                        </span>
                      </label>
                      <div className="panel-actions">
                        <button className="btn" onClick={() => setSelected(null)}>Cancel</button>
                        <button className="btn btn-primary" onClick={addSearchedTorrent} disabled={adding}>
                          {adding ? <span className="spinner" /> : <><Icon name="download" size={16} /> Download</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Add by link</h2>
        </div>
        <form
          className="search-bar"
          onSubmit={(e) => { e.preventDefault(); addMagnet(); }}
        >
          <div className="input-wrap">
            <Icon name="link" size={18} className="input-icon" />
            <input
              className="input input-with-icon"
              type="text"
              placeholder="magnet:?xt=… or https://…/file.torrent"
              value={magnet}
              onChange={(e) => setMagnet(e.target.value)}
            />
          </div>
          <button className="btn btn-lg" type="submit">Add</button>
        </form>
      </section>

      {showHistory && <SearchHistory onClose={() => setShowHistory(false)} />}
    </div>
  );
}

export default Search;
