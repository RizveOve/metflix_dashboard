import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { getQBittorrentServerUrl, makeQBittorrentRequest, addTorrent, checkDiskSpace } from './shows.js';

const router = express.Router();
const TMDB_URL = 'https://api.themoviedb.org/3';

// Read lazily so the value comes from .env
const getTMDBApiKey = () => process.env.TMDB_API_KEY;

const tmdbGet = async (endpoint, params = {}) => {
  const apiKey = getTMDBApiKey();
  if (!apiKey) {
    const error = new Error('TMDB API key not configured');
    error.status = 400;
    throw error;
  }
  const response = await axios.get(`${TMDB_URL}${endpoint}`, {
    params: { api_key: apiKey, ...params },
    timeout: 10000
  });
  return response.data;
};

const toMovie = (movie) => ({
  id: movie.id,
  title: movie.title,
  overview: movie.overview,
  releaseDate: movie.release_date,
  posterPath: movie.poster_path,
  backdropPath: movie.backdrop_path,
  voteAverage: movie.vote_average
});

// Trending movies this week (home page and Movies tab)
router.get('/trending', async (req, res) => {
  try {
    const data = await tmdbGet('/trending/movie/week');
    res.json({ results: data.results.slice(0, 20).map(toMovie) });
  } catch (error) {
    console.error('Error fetching trending movies:', error.message);
    res.status(error.status || 500).json({ error: error.message, results: [] });
  }
});

// Search TMDB for movies (live search)
router.get('/search/:query', async (req, res) => {
  const { query } = req.params;
  if (!query || query.length < 2) {
    return res.json({ results: [] });
  }
  try {
    const data = await tmdbGet('/search/movie', { query });
    res.json({ results: data.results.slice(0, 12).map(toMovie) });
  } catch (error) {
    console.error('Error searching movies:', error.message);
    res.status(error.status || 500).json({ error: error.message, results: [] });
  }
});

// ---------- Release picking ----------

const normalize = (text) =>
  text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

// Theatre recordings and screeners are never worth downloading
const LOW_QUALITY = /\b(cam|camrip|hdcam|ts|hdts|telesync|tc|telecine|scr|screener|dvdscr)\b/;
// Raw disc copies are huge (60-100 GB) for little visible gain
const DISC_COPY = /\b(remux|bdmv|iso|complete bluray)\b/;
const MAX_SIZE = 40 * 1024 ** 3;

const qualityTier = (name) => {
  if (/\b(2160p|4k|uhd)\b/.test(name)) return 2;
  if (/\b1080p\b/.test(name)) return 1;
  return 0;
};

// Same quality bar as shows: 1080p or better only, no disc copies or files
// over 40 GB. 4K wins when it's well seeded, otherwise the best-seeded 1080p.
const pickRelease = (results, title, year) => {
  const wanted = normalize(title);
  const candidates = results
    .filter(r => r.fileUrl && (r.fileUrl.startsWith('magnet:') || r.fileUrl.endsWith('.torrent')) && r.nbSeeders > 0)
    .map(r => ({ result: r, name: normalize(r.fileName || '') }))
    .filter(c => c.name.includes(wanted)
      && (!year || c.name.includes(String(year)))
      && !LOW_QUALITY.test(c.name)
      && !DISC_COPY.test(c.name)
      && !(c.result.fileSize > MAX_SIZE))
    .map(c => ({ ...c, tier: qualityTier(c.name) }))
    .filter(c => c.tier > 0);

  const best = (tier) => candidates
    .filter(c => c.tier === tier)
    .sort((a, b) => b.result.nbSeeders - a.result.nbSeeders)[0]?.result;

  const uhd = best(2);
  if (uhd && uhd.nbSeeders >= 10) return uhd;
  return best(1) || uhd || null;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Run one qBittorrent search to completion and return its results
const runSearch = async (pattern, onProgress) => {
  const serverUrl = getQBittorrentServerUrl();
  const start = await makeQBittorrentRequest(
    'POST',
    `${serverUrl}/api/v2/search/start`,
    `pattern=${encodeURIComponent(pattern)}&plugins=enabled&category=all`
  );
  const searchId = start.data.id;

  try {
    let lastTotal = -1;
    let stableCount = 0;
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const status = (await makeQBittorrentRequest('GET', `${serverUrl}/api/v2/search/status?id=${searchId}`)).data?.[0];
      if (!status) break;
      onProgress?.(status.total);
      stableCount = status.total > 0 && status.total === lastTotal ? stableCount + 1 : 0;
      lastTotal = status.total;
      if (status.status === 'Stopped' || stableCount >= 4) break;
    }
    const results = await makeQBittorrentRequest('GET', `${serverUrl}/api/v2/search/results?id=${searchId}&limit=500`);
    return results.data?.results || [];
  } finally {
    // Deleting also stops it, freeing one of qBittorrent's limited search slots
    makeQBittorrentRequest('POST', `${serverUrl}/api/v2/search/delete`, `id=${searchId}`).catch(() => {});
  }
};

// ---------- Download sessions ----------

const sessions = new Map(); // sessionId -> progress info

const downloadMovie = async (sessionId, title, year) => {
  const update = (info) => sessions.set(sessionId, { ...sessions.get(sessionId), ...info });

  try {
    if (!(await checkDiskSpace())) {
      update({ status: 'error', message: 'Less than 5 GB free on the download drive' });
      return;
    }

    const onProgress = (total) => update({
      message: `Searching… ${total} results`,
      progress: Math.min(70, 10 + total / 3)
    });

    let results = await runSearch(`${title} ${year || ''}`.trim(), onProgress);
    let pick = pickRelease(results, title, year);

    // Some releases leave the year out of the name
    if (!pick && year) {
      update({ message: 'Trying a wider search…', progress: 40 });
      results = await runSearch(title, onProgress);
      pick = pickRelease(results, title, null);
    }

    if (!pick) {
      update({ status: 'completed', success: false, progress: 100, message: 'No 1080p or 4K release found yet' });
      return;
    }

    update({ message: `Adding ${pick.fileName}`, progress: 85 });
    const added = await addTorrent(pick.fileUrl);
    update(added
      ? {
          status: 'completed',
          success: true,
          progress: 100,
          message: 'Added to downloads',
          release: { name: pick.fileName, size: pick.fileSize, seeders: pick.nbSeeders }
        }
      : { status: 'error', message: 'qBittorrent rejected the torrent' });
  } catch (error) {
    console.error('Movie download error:', error.message);
    update({ status: 'error', message: error.message });
  } finally {
    setTimeout(() => sessions.delete(sessionId), 10 * 60 * 1000);
  }
};

// Find and add the best release for a movie; poll download-progress for the outcome
router.post('/download', (req, res) => {
  const { title, year } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Movie title is required' });
  }

  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { status: 'searching', message: `Searching for ${title}…`, progress: 5 });
  downloadMovie(sessionId, title, year);
  res.json({ success: true, sessionId });
});

router.get('/download-progress/:sessionId', (req, res) => {
  res.json(sessions.get(req.params.sessionId) || { status: 'not_found', message: 'Download session not found' });
});

export default router;
