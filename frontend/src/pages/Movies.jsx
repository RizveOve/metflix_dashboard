import { useState, useEffect } from 'react';
import axios from 'axios';
import Icon from '../components/Icon';
import MovieSheet from '../components/MovieSheet';
import { PosterGrid } from '../components/Posters';
import useTmdbSearch from '../lib/useTmdbSearch';
import useMovieDownload from '../lib/useMovieDownload';

function Movies() {
  const search = useTmdbSearch('movies');
  const download = useMovieDownload();
  const [trending, setTrending] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    axios.get('/api/movies/trending')
      .then(res => setTrending(res.data.results || []))
      .catch(error => console.error('Error fetching trending movies:', error))
      .finally(() => setLoadingTrending(false));
  }, []);

  const searching = search.query.trim().length >= 2;
  const items = searching ? search.results : trending;
  const job = download.job;

  // Small badge on the poster being downloaded
  const badgeFor = (movie) => {
    if (job?.movieId !== movie.id) return null;
    if (download.busy) return 'Finding…';
    return job.success ? 'Added' : null;
  };

  return (
    <div className="fade-in wide">
      <div className="page-head">
        <div>
          <h1>Movies</h1>
          <p className="page-sub">Pick a movie and MetFlix grabs the best 4K or 1080p release.</p>
        </div>
      </div>

      <div className="input-wrap">
        <Icon name="search" size={18} className="input-icon" />
        <input
          className="input input-with-icon"
          type="search"
          placeholder="Search movies…"
          value={search.query}
          onChange={(e) => search.setQuery(e.target.value)}
        />
        {search.loading && <span className="spinner input-spinner" />}
      </div>

      <section className="section">
        <div className="section-head">
          <h2>{searching ? 'Results' : 'Trending this week'}</h2>
        </div>

        {!searching && loadingTrending ? (
          <div className="poster-grid">
            {[...Array(8)].map((_, i) => <div key={i} className="poster-card"><div className="poster-frame skeleton" /></div>)}
          </div>
        ) : items.length > 0 ? (
          <PosterGrid items={items} onSelect={setSelected} badgeFor={badgeFor} />
        ) : (
          <div className="empty empty-sm">
            <p>{searching && !search.loading ? `No movies found for "${search.query}".` : 'Nothing to show yet.'}</p>
          </div>
        )}
      </section>

      <p className="footnote">
        Skips cam and screener copies, disc remuxes and anything over 40 GB. 4K is used when it's well seeded, otherwise the best 1080p. Needs 5 GB free.
      </p>

      {selected && <MovieSheet movie={selected} download={download} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default Movies;
