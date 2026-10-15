import { useState, useCallback, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Downloads from './pages/Downloads';
import Search from './pages/Search';
import Shows from './pages/Shows';
import Settings from './pages/Settings';
import Toast from './components/Toast';
import Icon from './components/Icon';
import './App.css';

// Toast context for global toast notifications
const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

const NAV = [
  { to: '/', label: 'Downloads', icon: 'download', end: true },
  { to: '/search', label: 'Search', icon: 'search' },
  { to: '/shows', label: 'Shows', icon: 'tv' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

function App() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <BrowserRouter>
        <div className="app">
          <header className="topbar">
            <div className="topbar-inner">
              <span className="brand"><span className="brand-dot" />MetFlix</span>
              <nav className="nav" aria-label="Main">
                {NAV.map(item => (
                  <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
                    <Icon name={item.icon} size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          </header>

          <main className="page">
            <Routes>
              <Route path="/" element={<Downloads />} />
              <Route path="/search" element={<Search />} />
              <Route path="/shows" element={<Shows />} />
              <Route path="/settings" element={<Settings />} />
              {/* Old paths from the previous layout */}
              <Route path="/downloads" element={<Navigate to="/" replace />} />
              <Route path="/add-torrent" element={<Navigate to="/search" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <div className="toasts">
            {toasts.map(toast => (
              <Toast key={toast.id} {...toast} onClose={removeToast} />
            ))}
          </div>
        </div>
      </BrowserRouter>
    </ToastContext.Provider>
  );
}

export default App;
