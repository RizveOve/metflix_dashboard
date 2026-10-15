import { useEffect, useState } from 'react';
import axios from 'axios';

// Debounced TMDB search; kind is 'shows' or 'movies'
export default function useTmdbSearch(kind = 'shows', delay = 300) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/${kind}/search/${encodeURIComponent(q)}`);
        if (!cancelled) setResults(res.data.results || []);
      } catch (error) {
        console.error(`Error searching ${kind}:`, error);
        if (!cancelled) setResults([]);
      }
      if (!cancelled) setLoading(false);
    }, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, kind, delay]);

  const clear = () => { setQuery(''); setResults([]); };

  return { query, setQuery, results, loading, clear };
}
