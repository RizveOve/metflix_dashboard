import Icon from './Icon';
import { year } from '../lib/format';

// Works for TMDB movies ({ title, releaseDate }) and shows ({ name, firstAirDate })
export const titleOf = (item) => item.title || item.name;
export const yearOf = (item) => year(item.releaseDate || item.firstAirDate);

export function PosterCard({ item, onSelect, badge }) {
  return (
    <button className="poster-card" onClick={() => onSelect(item)}>
      <div className="poster-frame">
        {item.posterPath
          ? <img src={`https://image.tmdb.org/t/p/w342${item.posterPath}`} alt="" loading="lazy" />
          : <div className="poster-fallback"><Icon name="film" size={22} /><span>{titleOf(item)}</span></div>}
        {badge && <span className="poster-badge">{badge}</span>}
      </div>
      <div className="poster-title">{titleOf(item)}</div>
      <div className="poster-meta">
        {yearOf(item)}
        {item.voteAverage > 0 && <> · ★ {item.voteAverage.toFixed(1)}</>}
      </div>
    </button>
  );
}

// Horizontal scrolling row (home page)
export function PosterRow({ items, onSelect, loading }) {
  if (loading) {
    return (
      <div className="poster-row">
        {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="poster-card"><div className="poster-frame skeleton" /></div>)}
      </div>
    );
  }
  return (
    <div className="poster-row">
      {items.map(item => <PosterCard key={item.id} item={item} onSelect={onSelect} />)}
    </div>
  );
}

// Wrapping grid (Movies tab)
export function PosterGrid({ items, onSelect, badgeFor }) {
  return (
    <div className="poster-grid">
      {items.map(item => (
        <PosterCard key={item.id} item={item} onSelect={onSelect} badge={badgeFor?.(item)} />
      ))}
    </div>
  );
}
