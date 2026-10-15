import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../App';
import Icon from './Icon';
import MediaSheet from './MediaSheet';

// Trending show details: track new episodes, or jump to a full-season download
function ShowSheet({ show, tracked, onTracked, onClose }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [adding, setAdding] = useState(false);

  const track = async () => {
    setAdding(true);
    try {
      const response = await axios.post('/api/shows', {
        tmdbId: show.id,
        name: show.name,
        currentSeason: 1,
        currentEpisode: 0
      });
      showToast(response.data.catchUpEpisodes > 0
        ? `Tracking ${show.name}. Caught up on ${response.data.catchUpEpisodes} episodes.`
        : `Tracking ${show.name}`, 'success');
      onTracked?.();
      onClose();
    } catch (error) {
      showToast('Error adding show: ' + (error.response?.data?.error || error.message), 'error');
    }
    setAdding(false);
  };

  return (
    <MediaSheet
      item={show}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={() => navigate('/shows', { state: { tab: 'past', show } })}>
            Download a season
          </button>
          {tracked ? (
            <button className="btn" disabled><Icon name="check" size={16} /> Tracking</button>
          ) : (
            <button className="btn btn-primary" onClick={track} disabled={adding}>
              {adding ? <span className="spinner" /> : <Icon name="plus" size={16} />} Track new episodes
            </button>
          )}
        </>
      }
    />
  );
}

export default ShowSheet;
