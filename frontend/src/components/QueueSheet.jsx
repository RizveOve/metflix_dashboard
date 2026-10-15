import Sheet from './Sheet';
import { episodeCode } from '../lib/format';

// Pending automatic episode searches (from /api/shows/queue/status)
function QueueSheet({ status, onClear, onClose }) {
  const items = status?.queuedItems || [];

  return (
    <Sheet
      title="Search queue"
      onClose={onClose}
      footer={items.length > 0 && (
        <button className="btn btn-danger" onClick={onClear}>Clear queue ({items.length})</button>
      )}
    >
      {items.length === 0 ? (
        <p className="muted center">Nothing queued. Episode searches show up here while they wait their turn.</p>
      ) : (
        <>
          {status.processing && status.nextSearchIn > 0 && (
            <p className="muted small">Next search in {Math.round(status.nextSearchIn / 1000)}s · one search every {status.searchInterval}s</p>
          )}
          <div className="list list-flush">
            {items.map((item, i) => (
              <div key={i} className="row">
                <div className="row-main">
                  <div className="row-title">{item.showName}</div>
                  <div className="row-meta">
                    {item.episode != null
                      ? <span>{episodeCode(item.season, item.episode)}</span>
                      : item.season != null && <span>Season {item.season}</span>}
                    {item.searchType && <span>{item.searchType}</span>}
                    <span>Queued {new Date(item.queuedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

export default QueueSheet;
