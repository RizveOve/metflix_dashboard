import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import OngoingShows from './OngoingShows';
import PastShows from './PastShows';

const TABS = [
  { key: 'ongoing', label: 'Tracking', sub: 'New episodes download automatically as they air.' },
  { key: 'past', label: 'Full seasons', sub: 'Download a complete season in one go.' },
];

function Shows() {
  // Home can link here with { tab, show } to open a show's full-season download
  const { state } = useLocation();
  const [activeTab, setActiveTab] = useState(state?.tab || 'ongoing');
  const tab = TABS.find(t => t.key === activeTab);

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1>Shows</h1>
          <p className="page-sub">{tab.sub}</p>
        </div>
      </div>

      <div className="seg seg-full" role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={activeTab === t.key ? 'active' : ''}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'ongoing' ? <OngoingShows /> : <PastShows initialShow={state?.show} />}
    </div>
  );
}

export default Shows;
