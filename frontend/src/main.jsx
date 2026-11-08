import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { ToastProvider, ConfirmProvider } from './components/ui.jsx';
import { takeDailySnapshot } from './data/db.js';
import './styles/base.css';
import './styles/store.css';
import './styles/admin.css';

// The single-file preview build uses hash routing (works anywhere); the normal build
// uses clean URLs such as /psa-slabs and /admin (see vercel.json rewrites).
const Router = import.meta.env.MODE === 'single' ? HashRouter : BrowserRouter;

takeDailySnapshot();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <ToastProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ToastProvider>
    </Router>
  </React.StrictMode>,
);
