// Formatting and qBittorrent state helpers shared across pages

export const formatSize = (bytes) => {
  if (!bytes) return '0 MB';
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
};

export const formatSpeed = (bytesPerSec) => {
  const mb = bytesPerSec / 1024 ** 2;
  return mb >= 1 ? `${mb.toFixed(1)} MB/s` : `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
};

export const formatEta = (seconds) => {
  if (seconds === 8640000 || seconds <= 0) return '∞';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const ACTIVE_STATES = ['downloading', 'stalledDL', 'metaDL', 'forcedDL'];
// qBittorrent 5 reports stopped*, older versions paused*
const PAUSED_STATES = ['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP'];

export const isActive = (t) => ACTIVE_STATES.includes(t.state);
export const isPaused = (t) => PAUSED_STATES.includes(t.state);

const STATUS_TEXT = {
  downloading: 'Downloading',
  stalledDL: 'Waiting for peers',
  pausedDL: 'Paused',
  pausedUP: 'Paused',
  stoppedDL: 'Paused',
  stoppedUP: 'Paused',
  uploading: 'Seeding',
  forcedUP: 'Seeding',
  stalledUP: 'Completed',
  queuedDL: 'Queued',
  queuedUP: 'Queued',
  checkingDL: 'Checking',
  checkingUP: 'Checking',
  checkingResumeData: 'Checking',
  metaDL: 'Getting metadata',
  forcedDL: 'Downloading',
  moving: 'Moving',
  error: 'Error',
  missingFiles: 'Missing files',
  allocating: 'Allocating',
};

export const statusText = (state) => STATUS_TEXT[state] || state;

// Visual tone for status label and progress bar
export const statusTone = (t) => {
  if (t.state === 'error' || t.state === 'missingFiles') return 'error';
  if (isPaused(t)) return 'paused';
  if (t.progress >= 1) return 'done';
  if (isActive(t)) return 'active';
  return 'idle';
};

// State a torrent shows right after a pause/resume, before the next poll confirms it
export const optimisticState = (t, action) =>
  action === 'pause'
    ? (t.state.includes('DL') ? 'stoppedDL' : 'stoppedUP')
    : (t.progress >= 1 ? 'uploading' : 'downloading');

export const episodeCode = (season, episode) =>
  `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;

export const year = (date) => (date ? new Date(date).getFullYear() : null);
