import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Icon from '../components/Icon';
import MovieSheet from '../components/MovieSheet';
import ShowSheet from '../components/ShowSheet';
import { PosterRow, yearOf } from '../components/Posters';
import useMovieDownload from '../lib/useMovieDownload';
import { formatSize, formatSpeed, formatEta, isActive } from '../lib/format';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 5) return 'Up late?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

function Home() {
  const download = useMovieDownload();
  const [movies, setMovies] = useState([]);
  const [shows, setShows] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [torrents, setTorrents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [online, setOnline] = useState(null); // null until the first check
  const [tracked, setTracked] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedShow, setSelectedShow] = useState(null);

  const fetchTracked = useCallback(() => {
    axios.get('/api/shows')
      .then(res => setTracked(res.data.shows || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.allSettled([axios.get('/api/movies/trending'), axios.get('/api/shows/trending')])
      .then(([m, s]) => {
        if (m.status === 'fulfilled') setMovies(m.value.data.results || []);
        if (s.status === 'fulfilled') setShows(s.value.data.results || []);
      })
      .finally(() => setLoadingTrending(false));
    fetchTracked();
  }, [fetchTracked]);

  // Live server status, refreshed every 5s
  useEffect(() => {
    const load = async () => {
      try {
        const [t, s] = await Promise.all([
          axios.get('/api/qbittorrent/torrents'),
          axios.get('/api/qbittorrent/summary')
        ]);
        setTorrents(t.data);
        setSummary(s.data);
        setOnline(true);
      } catch {
        setOnline(false);
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  // Hero rotates through the top trending movies that have artwork
  const heroes = movies.filter(m => m.backdropPath).slice(0, 5);
  const hero = heroes[heroIndex % Math.max(heroes.length, 1)];

  useEffect(() => {
    if (heroes.length < 2) return;
    const timer = setInterval(() => setHeroIndex(i => (i + 1) % heroes.length), 8000);
    return () => clearInterval(timer);
  }, [heroes.length, heroIndex]);

  const inProgress = torrents
    .filter(t => t.progress < 1)
    .sort((a, b) => Number(isActive(b)) - Number(isActive(a)));
  const trackedIds = new Set(tracked.map(s => s.tmdbId));

  const downloadHero = () => {
    setSelectedMovie(hero);
    download.start(hero);
  };

  return (
    <div className="home fade-in">
      {hero ? (
        <section className="hero">
          {heroes.map((m, i) => (
            <img
              key={m.id}
              className={`hero-img ${i === heroIndex ? 'on' : ''}`}
              src={`https://image.tmdb.org/t/p/w1280${m.backdropPath}`}
              alt=""
            />
          ))}
          <div className="hero-shade" />
          <div className="hero-content">
            <span className="hero-kicker">#{heroIndex + 1} trending this week</span>
            <h1 className="hero-title">{hero.title}</h1>
            <div className="hero-meta">
              {yearOf(hero)}
              {hero.voteAverage > 0 && <> · ★ {hero.voteAverage.toFixed(1)}</>}
            </div>
            {hero.overview && <p className="hero-overview">{hero.overview}</p>}
            <div className="hero-actions">
              <button className="btn btn-primary btn-lg" onClick={downloadHero} disabled={download.busy}>
                <Icon name="download" size={16} /> Download
              </button>
              <button className="btn btn-glass btn-lg" onClick={() => setSelectedMovie(hero)}>
                More info
              </button>
            </div>
          </div>
          {heroes.length > 1 && (
            <div className="hero-dots">
              {heroes.map((m, i) => (
                <button
                  key={m.id}
                  className={i === heroIndex ? 'on' : ''}
                  onClick={() => setHeroIndex(i)}
                  aria-label={`Show ${m.title}`}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className={`hero ${loadingTrending ? 'skeleton' : 'hero-plain'}`}>
          {!loadingTrending && (
            <div className="hero-content">
              <h1 className="hero-title">Welcome to MetFlix</h1>
              <p className="hero-overview">Find a movie or show and it lands straight in your library.</p>
            </div>
          )}
        </section>
      )}

      <div className="greeting">
        <h2>{greeting()}</h2>
        {online !== null && (
          <span className={`server-pill ${online ? 'on' : 'off'}`}>
            <span className="dot" />{online ? 'Server online' : 'Server offline'}
          </span>
        )}
      </div>

      <div className="stats">
        <Link to="/downloads" className="stat">
          <span className="stat-label">Downloading</span>
          <span className="stat-value">{torrents.filter(isActive).length}</span>
        </Link>
        <Link to="/downloads" className="stat">
          <span className="stat-label">Speed</span>
          <span className="stat-value">{summary ? formatSpeed(summary.downloadSpeed) : '—'}</span>
        </Link>
        <div className="stat">
          <span className="stat-label">Free space</span>
          <span className="stat-value">{summary?.freeSpace != null ? formatSize(summary.freeSpace) : '—'}</span>
        </div>
        <Link to="/shows" className="stat">
          <span className="stat-label">Tracked shows</span>
          <span className="stat-value">{tracked.length}</span>
        </Link>
      </div>

      {inProgress.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Downloading now</h2>
            <Link to="/downloads" className="see-all">See all <Icon name="chevronRight" size={14} /></Link>
          </div>
          <div className="list">
            {inProgress.slice(0, 3).map(t => {
              const pct = (t.progress * 100).toFixed(1);
              return (
                <Link key={t.hash} to="/downloads" className="row row-button">
                  <div className="row-main">
                    <div className="row-title clamp-1">{t.name}</div>
                    <div className="progress">
                      <div className={`progress-fill ${isActive(t) ? 'tone-active' : 'tone-idle'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="row-meta">
                      <span>{pct}%</span>
                      {t.eta > 0 && t.eta < 8640000 && <span>{formatEta(t.eta)} left</span>}
                      {t.dlspeed > 0 && <span className="speed-down">↓ {formatSpeed(t.dlspeed)}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Trending movies</h2>
          <Link to="/movies" className="see-all">Browse <Icon name="chevronRight" size={14} /></Link>
        </div>
        <PosterRow items={movies} onSelect={setSelectedMovie} loading={loadingTrending} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Trending shows</h2>
          <Link to="/shows" className="see-all">Browse <Icon name="chevronRight" size={14} /></Link>
        </div>
        <PosterRow items={shows} onSelect={setSelectedShow} loading={loadingTrending} />
      </section>

      {selectedMovie && (
        <MovieSheet movie={selectedMovie} download={download} onClose={() => setSelectedMovie(null)} />
      )}
      {selectedShow && (
        <ShowSheet
          show={selectedShow}
          tracked={trackedIds.has(selectedShow.id)}
          onTracked={fetchTracked}
          onClose={() => setSelectedShow(null)}
        />
      )}
    </div>
  );
}

export default Home;
