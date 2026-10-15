import Sheet from './Sheet';
import { titleOf, yearOf } from './Posters';

// Detail sheet for a TMDB movie or show: backdrop, facts, overview, then
// whatever actions/progress the caller passes in
function MediaSheet({ item, onClose, footer, children }) {
  const image = item.backdropPath
    ? `https://image.tmdb.org/t/p/w780${item.backdropPath}`
    : item.posterPath && `https://image.tmdb.org/t/p/w500${item.posterPath}`;

  return (
    <Sheet title={titleOf(item)} onClose={onClose} footer={footer}>
      {image && (
        <div className="media-backdrop">
          <img src={image} alt="" />
        </div>
      )}
      <div className="row-meta media-meta">
        {yearOf(item) && <span>{yearOf(item)}</span>}
        {item.voteAverage > 0 && <span>★ {item.voteAverage.toFixed(1)}</span>}
      </div>
      {item.overview && <p className="media-overview">{item.overview}</p>}
      {children}
    </Sheet>
  );
}

export function JobProgress({ job }) {
  if (!job) return null;
  const failed = job.status === 'error' || (job.status === 'completed' && !job.success);
  return (
    <div className="season-progress">
      <div className="season-progress-text">
        <span className={failed ? 'text-error' : ''}>{job.message}</span>
        {!failed && <span className="muted">{Math.round(job.progress || 0)}%</span>}
      </div>
      {!failed && (
        <div className="progress">
          <div className={`progress-fill ${job.success ? 'tone-done' : 'tone-active'}`} style={{ width: `${job.progress || 0}%` }} />
        </div>
      )}
      {job.release && <p className="muted small release-name">{job.release.name}</p>}
    </div>
  );
}

export default MediaSheet;
