import { useEffect } from 'react';
import Icon from './Icon';

const icons = { success: 'check', error: 'alert', warning: 'alert', info: 'alert' };

function Toast({ id, message, type = 'info', onClose, duration = 3000 }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  return (
    <div className={`toast toast-${type}`} role="status">
      <Icon name={icons[type] || 'alert'} size={16} className="toast-icon" />
      <span className="toast-msg">{message}</span>
      <button className="toast-close" onClick={() => onClose(id)} aria-label="Dismiss">
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

export default Toast;
