
import React from 'react';
import { useNavigate } from 'react-router-dom';

const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();

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
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
