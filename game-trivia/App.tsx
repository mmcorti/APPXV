import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import AdminView from './components/AdminView';
import BigScreenView from './components/BigScreenView';
import GuestView from './components/GuestView';

const Navigation: React.FC = () => {
    const location = useLocation();
    
    // Hide nav on the big screen or guest view to keep it immersive
    // Only show a small "Home" link if we are at root and not in a specific mode yet
    if (location.pathname === '/screen' || location.pathname === '/game') return null;

    return (
        <nav className="p-4 bg-brand-dark/50 fixed top-0 left-0 w-full z-50 flex gap-4 text-xs text-gray-500 hover:text-white transition-colors">
             {/* Hidden dev links for easy navigation during demo */}
             <div className="opacity-0 hover:opacity-100 flex gap-4 bg-black/80 p-2 rounded">
                <Link to="/">Guest Join</Link>
                <Link to="/admin">Admin Panel</Link>
                <Link to="/screen">Big Screen</Link>
             </div>
        </nav>
    );
};

export default function App() {
  return (
    <HashRouter>
        <Navigation />
        <div className="min-h-screen bg-brand-dark text-white overflow-hidden">
            <Routes>
                <Route path="/" element={<GuestView />} />
                <Route path="/admin" element={<AdminView />} />
                <Route path="/screen" element={<BigScreenView />} />
            </Routes>
        </div>
    </HashRouter>
  );
}