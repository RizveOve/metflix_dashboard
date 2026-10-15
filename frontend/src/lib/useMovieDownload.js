import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useToast } from '../App';
import { year } from './format';

const DONE = ['completed', 'error', 'not_found'];

// Starts a "best release" movie download and tracks its progress.
// Keep it in a page (not a sheet) so progress survives closing the sheet.
export default function useMovieDownload() {
  const { showToast } = useToast();
  const [job, setJob] = useState(null); // { movieId, status, message, progress, success }
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const start = async (movie) => {
    clearTimeout(timer.current);
    setJob({ movieId: movie.id, status: 'searching', message: 'Starting…', progress: 0 });

    try {
      const { data } = await axios.post('/api/movies/download', {
        tmdbId: movie.id,
        title: movie.title,
        year: year(movie.releaseDate)
      });

      const poll = async () => {
        try {
          const { data: progress } = await axios.get(`/api/movies/download-progress/${data.sessionId}`);
          setJob({ movieId: movie.id, ...progress });
          if (progress.status === 'completed') {
            showToast(progress.success ? `${movie.title} added to downloads` : progress.message,
              progress.success ? 'success' : 'warning', 4000);
          } else if (progress.status === 'error' || progress.status === 'not_found') {
            showToast(`Couldn't download ${movie.title}: ${progress.message}`, 'error', 5000);
          } else {
            timer.current = setTimeout(poll, 2000);
          }
        } catch (error) {
          setJob(prev => ({ ...prev, status: 'error', message: error.message }));
        }
      };
      timer.current = setTimeout(poll, 1500);
    } catch (error) {
      const message = error.response?.data?.error || error.message;
      setJob({ movieId: movie.id, status: 'error', message });
      showToast('Error starting download: ' + message, 'error');
    }
  };

  const busy = Boolean(job && !DONE.includes(job.status));
  return { job, start, busy };
}
