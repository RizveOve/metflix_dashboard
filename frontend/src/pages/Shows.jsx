import { useState } from 'react';
import OngoingShows from './OngoingShows';
import PastShows from './PastShows';

const TABS = [
  { key: 'ongoing', label: 'Tracking', sub: 'New episodes download automatically as they air.' },
  { key: 'past', label: 'Full seasons', sub: 'Download a complete season in one go.' },
];

function Shows() {
  const [activeTab, setActiveTab] = useState('ongoing');
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

      {activeTab === 'ongoing' ? <OngoingShows /> : <PastShows />}
    </div>
  );
}

export default Shows;
