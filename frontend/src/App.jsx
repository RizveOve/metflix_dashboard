import { useState, useCallback, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, Link } from 'react-router-dom';
import Home from './pages/Home';
import Movies from './pages/Movies';
import Shows from './pages/Shows';
import Downloads from './pages/Downloads';
import Search from './pages/Search';
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
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/movies', label: 'Movies', icon: 'film' },
  { to: '/shows', label: 'Shows', icon: 'tv' },
  { to: '/downloads', label: 'Downloads', icon: 'download' },
  { to: '/search', label: 'Search', icon: 'search' },
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
              <Link to="/" className="logo" aria-label="MetFlix home">
                <span className="logo-met">Met</span>Flix
              </Link>
              <nav className="nav" aria-label="Main">
                {NAV.map(item => (
                  <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
                    <Icon name={item.icon} size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
              <NavLink to="/settings" className="icon-btn settings-link" aria-label="Settings" title="Settings">
                <Icon name="gear" size={19} />
              </NavLink>
            </div>
          </header>

          <main className="page">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/movies" element={<Movies />} />
              <Route path="/shows" element={<Shows />} />
              <Route path="/downloads" element={<Downloads />} />
              <Route path="/search" element={<Search />} />
              <Route path="/settings" element={<Settings />} />
              {/* Old path from the previous layout */}
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
