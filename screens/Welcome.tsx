
import React from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000/api';

const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  const plans = [
    {
      name: 'FREEMIUM',
      price: '$0',
      features: [
        '1 Evento',
        '50 Invitados',
        '3 Staff',
        'FotoWall Básico (20 fotos)',
        'Moderación Manual'
      ],
      buttonText: 'Comenzar Gratis',
      buttonAction: () => navigate('/login'),
      color: 'bg-[#3b82f6]',
      isPopular: false
    },
    {
      name: 'PREMIUM',
      price: '$25.000',
      features: [
        '5 Eventos',
        '200 Invitados',
        '20 Staff',
        'FotoWall Pro (200 fotos)',
        'Moderación IA Google Vision'
      ],
      buttonText: 'Elegir Premium',
      buttonAction: () => navigate('/login'),
      color: 'bg-[#135bec]',
      isPopular: true
    },
    {
      name: 'VIP',
      price: '$250.000',
      features: [
        'Eventos Ilimitados',
        'Invitados Ilimitados',
        'Staff Ilimitado',
        'FotoWall Enterprise (1,000 fotos)',
        'Moderación IA Avanzada',
        'Soporte prioritario'
      ],
      buttonText: 'Contactar para VIP',
      buttonAction: () => window.location.href = 'mailto:tech@madib.com.ar',
      color: 'bg-gradient-to-r from-[#b89b5e] to-[#d4af37]',
      isPopular: false
    }
  ];

  return (
    <div className="relative min-h-screen w-full font-['Inter',sans-serif] overflow-x-hidden">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1541339907198-e08756ebafe3?auto=format&fit=crop&q=80&w=1200")' }}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center px-4 pt-12 pb-24 min-h-screen">

        {/* Logo and Main CTA Card */}
        <div className="w-full max-w-[360px] flex flex-col items-center justify-center rounded-[40px] bg-white/10 backdrop-blur-xl border border-white/20 mb-16 shadow-2xl py-12 px-8">
          <div className="flex flex-col items-center mb-10">
            <h1 className="text-white text-7xl font-black tracking-tighter flex items-center italic drop-shadow-lg">
              A<span className="text-[#135bec] tracking-[-0.1em]">P</span>PXV
            </h1>
          </div>

          <button
            onClick={() => navigate('/login')}
            className="w-full py-4 px-6 rounded-full bg-[#135bec] text-white font-black text-lg shadow-xl hover:bg-[#0f4bbd] transition-all transform active:scale-95 border border-white/20 uppercase tracking-widest"
          >
            Comenzar a Planear
          </button>
        </div>

        {/* Pricing Cards Container */}
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 px-4 md:px-0">
          {plans.map((plan, idx) => (
            <div
              key={idx}
              className={`relative bg-white rounded-[32px] overflow-hidden flex flex-col shadow-2xl transition-all duration-300 hover:scale-[1.03] ${plan.isPopular ? 'ring-4 ring-[#135bec]' : ''}`}
            >
              {plan.isPopular && (
                <div className="absolute top-0 right-8 transform -translate-y-1/2 bg-white px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 z-20 border border-slate-100">
                  <span className="material-symbols-outlined text-[16px] text-[#135bec]">star</span>
                  <span className="text-[11px] font-black text-[#1e293b] uppercase tracking-widest">Popular Choice</span>
                </div>
              )}

              {/* Card Header */}
              <div className={`${plan.color} py-7 px-4 text-center shadow-inner`}>
                <h3 className="text-white text-xl font-black tracking-[0.2em]">{plan.name}</h3>
              </div>

              {/* Card Body */}
              <div className="p-10 flex-1 flex flex-col items-center text-center">
                <p className="text-[#1e293b] text-4xl font-black mb-8">{plan.price}</p>

                <ul className="space-y-4 mb-12 w-full">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-center gap-4 text-[13px] font-bold text-slate-600">
                      <div className="flex-shrink-0 size-5 rounded-full bg-blue-50 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#135bec] text-[14px] font-black">check</span>
                      </div>
                      <span className="text-left leading-tight">{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={plan.buttonAction}
                  className={`w-full py-4 rounded-full border-2 border-[#135bec]/20 text-[#135bec] font-black text-xs uppercase tracking-widest hover:bg-[#135bec] hover:text-white transition-all transform active:scale-95 shadow-sm ${plan.isPopular ? 'bg-[#135bec] text-white border-transparent shadow-lg shadow-blue-500/30' : 'bg-transparent'}`}
                >
                  {plan.buttonText}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center opacity-80 group">
          <p className="text-white text-sm font-black tracking-widest uppercase mb-1">by Madiba Tech</p>
          <a href="mailto:tech@madib.com.ar" className="text-white/60 text-xs font-bold hover:text-white transition-colors">tech@madib.com.ar</a>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
