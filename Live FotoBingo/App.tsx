import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AdminView } from './components/AdminView';
import { BigScreenView } from './components/BigScreenView';
import { GuestView } from './components/GuestView';

// Navigation Helper for Demo Purposes (Hidden in production ideally)
const DevNav = () => {
  const location = useLocation();
  // Don't show nav on the Big Screen or Guest View to keep it clean
  if (location.pathname === '/big-screen' || location.pathname === '/play') return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-2 rounded-lg text-xs z-50 flex gap-2 backdrop-blur-sm">
      <Link to="/admin" className="hover:text-yellow-300">Admin</Link> |
      <Link to="/big-screen" className="hover:text-yellow-300">Screen</Link> |
      <Link to="/play" className="hover:text-yellow-300">Guest</Link>
    </div>
  );
};

const Home = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
    <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
      <h1 className="text-3xl font-bold mb-2 text-indigo-600">Photo Bingo Hub</h1>
      <p className="text-gray-500 mb-8">Select your role to continue</p>
      
      <div className="space-y-3">
        <Link to="/admin" className="block w-full py-4 px-6 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors flex items-center justify-between group">
          <span>Admin Dashboard</span>
          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
        </Link>
        <Link to="/big-screen" className="block w-full py-4 px-6 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-between group">
          <span>Big Screen Display</span>
          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">tv</span>
        </Link>
        <Link to="/play" className="block w-full py-4 px-6 border-2 border-indigo-100 text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-colors flex items-center justify-between group">
          <span>Guest Interface</span>
          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">smartphone</span>
        </Link>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminView />} />
        <Route path="/big-screen" element={<BigScreenView />} />
        <Route path="/play" element={<GuestView />} />
      </Routes>
      <DevNav />
    </HashRouter>
  );
};

export default App;