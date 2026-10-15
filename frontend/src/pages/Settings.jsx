import { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../App';
import Icon from '../components/Icon';

function Settings() {
  const { showToast } = useToast();
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    axios.get('/api/qbittorrent/auto-stop/config')
      .then(res => setConfig(res.data))
      .catch(error => console.error('Error fetching auto-stop config:', error));
  }, []);

  const save = async (next) => {
    try {
      const response = await axios.post('/api/qbittorrent/auto-stop/config', next);
      setConfig(response.data.config);
      showToast(response.data.message, 'success');
    } catch (error) {
      showToast('Error updating auto-stop settings: ' + error.message, 'error');
    }
  };

  const processNow = async () => {
    setProcessing(true);
    try {
      const response = await axios.post('/api/qbittorrent/auto-stop/process');
      showToast(response.data.processed > 0
        ? `Stopped seeding ${response.data.processed} torrent(s)`
        : (response.data.message || 'Nothing to stop'), response.data.processed > 0 ? 'success' : 'info');
      const statsRes = await axios.get('/api/qbittorrent/auto-stop/stats');
      setStats(statsRes.data);
    } catch (error) {
      showToast('Error processing auto-stop: ' + error.message, 'error');
    }
    setProcessing(false);
  };

  // Number fields update locally and save when the field loses focus
  const numberField = (key, label, hint, { step = '1', parse = parseInt, placeholder } = {}) => (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        type="number"
        min="0"
        step={step}
        placeholder={placeholder}
        value={config[key] ?? ''}
        onChange={(e) => setConfig({ ...config, [key]: e.target.value === '' ? null : parse(e.target.value) })}
        onBlur={() => save(config)}
      />
      <small>{hint}</small>
    </label>
  );

  const qbUrl = `${window.location.protocol}//${window.location.hostname}:8080`;

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Auto-stop seeding</h2>
        </div>
        <div className="card">
          {!config ? (
            <div className="row skeleton" />
          ) : (
            <>
              <div className="setting-line">
                <div>
                  <div className="row-title">Stop seeding when downloads finish</div>
                  <div className="row-meta"><span>Frees up upload bandwidth once a torrent completes</span></div>
                </div>
                <button
                  className={`switch ${config.enabled ? 'on' : ''}`}
                  role="switch"
                  aria-checked={config.enabled}
                  aria-label="Auto-stop seeding"
                  onClick={() => save({ ...config, enabled: !config.enabled })}
                />
              </div>

              {config.enabled && (
                <>
                  <div className="fields">
                    {numberField('delayMinutes', 'Delay (minutes)', '0 stops immediately', { placeholder: '0' })}
                    {numberField('ratioLimit', 'Ratio limit', 'Optional, e.g. 2.0', { step: '0.1', parse: parseFloat, placeholder: '—' })}
                    {numberField('seedTimeLimit', 'Seed time (minutes)', 'Optional, e.g. 60', { placeholder: '—' })}
                  </div>
                  <div className="panel-actions">
                    {stats && (
                      <span className="muted small grow">
                        {stats.processedTorrents} processed · checked {new Date(stats.lastCheck).toLocaleTimeString()}
                      </span>
                    )}
                    <button className="btn" onClick={processNow} disabled={processing}>
                      {processing ? <span className="spinner" /> : <Icon name="refresh" size={14} />} Run now
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Links</h2>
        </div>
        <div className="list">
          <a className="row row-button" href={qbUrl} target="_blank" rel="noopener noreferrer">
            <div className="row-main">
              <div className="row-title">qBittorrent Web UI</div>
              <div className="row-meta"><span>{qbUrl.replace(/^https?:\/\//, '')}</span></div>
            </div>
            <Icon name="external" size={16} className="muted" />
          </a>
        </div>
      </section>
    </div>
  );
}

export default Settings;
