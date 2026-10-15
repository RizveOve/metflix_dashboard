import Icon from './Icon';
import { year } from '../lib/format';

// TMDB search box + result list, shared by the Tracking and Full seasons tabs
function ShowResults({ search, placeholder, renderAction, onPick }) {
  const { query, setQuery, results, loading } = search;

  return (
    <div className="show-search">
      <div className="input-wrap">
        <Icon name="search" size={18} className="input-icon" />
        <input
          className="input input-with-icon"
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading && <span className="spinner input-spinner" />}
      </div>

      {results.length > 0 && (
        <div className="list show-results">
          {results.map(show => (
            <div
              key={show.id}
              className={`row show-row ${onPick ? 'is-clickable' : ''}`}
              onClick={onPick ? () => onPick(show) : undefined}
            >
              <Poster path={show.posterPath} alt={show.name} />
              <div className="row-main">
                <div className="row-title">{show.name}</div>
                <div className="row-meta">
                  {year(show.firstAirDate) && <span>{year(show.firstAirDate)}</span>}
                  {show.voteAverage > 0 && <span>★ {show.voteAverage.toFixed(1)}</span>}
                </div>
                {show.overview && <p className="row-desc">{show.overview}</p>}
              </div>
              {renderAction && <div className="row-actions">{renderAction(show)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Poster({ path, alt, size = 'w92', className = '' }) {
  return path
    ? <img className={`poster ${className}`} src={`https://image.tmdb.org/t/p/${size}${path}`} alt={alt} loading="lazy" />
    : <div className={`poster poster-empty ${className}`}><Icon name="tv" size={16} /></div>;
}

export default ShowResults;
