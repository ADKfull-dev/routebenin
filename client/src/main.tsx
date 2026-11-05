import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './index.css';
import { App } from './App';
import { Dashboard } from './pages/Dashboard';
import { Optimize } from './pages/Optimize';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { ToastProvider } from './components/Toast';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'optimiser', element: <Optimize /> },
      { path: 'historique', element: <History /> },
      { path: 'parametres', element: <Settings /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </React.StrictMode>,
);
