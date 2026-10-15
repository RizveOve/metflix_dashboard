import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import MediaSheet, { JobProgress } from './MediaSheet';
import { yearOf } from './Posters';

// download = useMovieDownload() from the parent page, so progress outlives the sheet
function MovieSheet({ movie, download, onClose }) {
  const navigate = useNavigate();
  const job = download.job?.movieId === movie.id ? download.job : null;
  const running = download.busy && job;

  return (
    <MediaSheet
      item={movie}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn"
            onClick={() => navigate(`/search?q=${encodeURIComponent(`${movie.title} ${yearOf(movie) || ''}`.trim())}`)}
          >
            Choose release
          </button>
          <button
            className="btn btn-primary"
            onClick={() => download.start(movie)}
            disabled={download.busy}
          >
            {running ? <span className="spinner" /> : <Icon name="download" size={16} />}
            {running ? 'Finding release…' : job?.success ? 'Download again' : 'Download'}
          </button>
        </>
      }
    >
      {job ? (
        <JobProgress job={job} />
      ) : (
        <p className="muted small">
          Download picks the best-seeded 4K or 1080p release automatically. Choose release lets you pick one yourself.
        </p>
      )}
    </MediaSheet>
  );
}

export default MovieSheet;
