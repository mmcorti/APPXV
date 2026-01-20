
import React from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000/api';

const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col justify-between overflow-y-auto no-scrollbar bg-background-light dark:bg-background-dark">
      <div className="flex-1 w-full px-4 pt-4 pb-2">
        <div className="flex justify-center py-4 mb-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-white shadow-lg">
              <span className="material-symbols-outlined text-2xl">celebration</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-text-main dark:text-white">APPXV</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 h-auto max-w-md mx-auto">
          <div className="flex flex-col gap-3">
            <div className="w-full bg-center bg-no-repeat aspect-[3/4] bg-cover rounded-2xl shadow-sm relative overflow-hidden group" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=400")' }}>
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
            </div>
            <div className="w-full bg-center bg-no-repeat aspect-square bg-cover rounded-2xl shadow-sm relative overflow-hidden group" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=400")' }}>
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-8">
            <div className="w-full bg-center bg-no-repeat aspect-square bg-cover rounded-2xl shadow-sm relative overflow-hidden group" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=400")' }}>
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
            </div>
            <div className="w-full bg-center bg-no-repeat aspect-[3/4] bg-cover rounded-2xl shadow-sm relative overflow-hidden group" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80&w=400")' }}>
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col w-full bg-background-light dark:bg-background-dark z-10">
        <div className="h-8 bg-gradient-to-b from-transparent to-background-light dark:to-background-dark -mt-8 w-full"></div>
        <div className="px-6 pt-2 pb-6 text-center">
          <h1 className="text-text-main dark:text-white tracking-tight text-3xl font-extrabold leading-tight pb-3">
            Crea Eventos Únicos
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-base font-medium leading-relaxed max-w-[320px] mx-auto">
            Planificación integral para celebraciones personales y eventos corporativos. Todo en un solo lugar.
          </p>
        </div>
        <div className="flex flex-col gap-3 px-6 pb-10 w-full max-w-[480px] md:max-w-md mx-auto">
          <button onClick={() => navigate('/login')} className="group flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary text-white text-base font-bold leading-normal tracking-wide shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200">
            <span className="truncate">Comenzar a Planear</span>
          </button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            <span className="text-gray-400 text-xs font-medium">o</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="group flex w-full cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-xl h-14 px-5 bg-white dark:bg-slate-800 text-gray-700 dark:text-white text-base font-semibold leading-normal tracking-wide border border-gray-200 dark:border-gray-600 shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Continuar con Google</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
