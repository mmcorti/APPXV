
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
      color: 'bg-[#135bec]',
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
    <div className="relative min-h-screen w-full font-['Inter',sans-serif] overflow-x-hidden bg-white">
      {/* Background Image - Vibrant event setting */}
      <div
        className="fixed inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=1600")' }}
      >
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center px-4 pt-10 pb-20 min-h-screen">

        {/* Logo and Main CTA Card (Transparent Glass) */}
        <div className="w-full max-w-[380px] h-[340px] flex flex-col items-center justify-center rounded-[48px] bg-white/20 backdrop-blur-3xl border border-white/40 mb-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] px-10">
          {/* Logo Section */}
          <div className="mb-10 scale-110">
            <h1 className="text-white text-7xl font-black italic tracking-tighter flex items-end drop-shadow-md">
              <span className="text-[90px] leading-none">A</span>
              <span className="text-[#135bec] tracking-[-0.15em] ml-[-12px]">P</span>
              <span className="ml-[4px]">PXV</span>
            </h1>
          </div>

          {/* Main Button - Exactly as requested */}
          <button
            onClick={() => navigate('/login')}
            className="w-full max-w-[240px] py-3 px-6 rounded-full bg-[#135bec] text-white font-extrabold text-base shadow-lg hover:bg-[#0f4bbd] transition-all transform active:scale-95 border-2 border-white/50"
          >
            Comenzar a Planear
          </button>
        </div>

        {/* Pricing Cards Container */}
        <div className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16 px-4">
          {plans.map((plan, idx) => (
            <div
              key={idx}
              className={`relative bg-white rounded-[40px] overflow-hidden flex flex-col shadow-2xl transition-all duration-300 hover:scale-[1.02] ${plan.isPopular ? 'ring-[6px] ring-[#135bec] border-transparent' : 'border border-slate-100'}`}
            >
              {plan.isPopular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-5 py-2 rounded-full shadow-xl flex items-center gap-2 z-20 border border-slate-100">
                  <span className="material-symbols-outlined text-[16px] text-[#135bec] font-black">star</span>
                  <span className="text-[11px] font-black text-[#1e293b] uppercase tracking-widest leading-none">Popular Choice</span>
                </div>
              )}

              {/* Card Header */}
              <div className={`${plan.color} py-8 px-4 text-center shadow-inner`}>
                <h3 className="text-white text-xl font-black tracking-[0.2em]">{plan.name}</h3>
              </div>

              {/* Card Body */}
              <div className="p-10 flex-1 flex flex-col items-center">
                <p className="text-[#1e293b] text-4xl font-black mb-8 tracking-tighter">{plan.price}</p>

                <ul className="space-y-4 mb-12 w-full">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-3.5 text-[14px] font-bold text-slate-600 leading-tight">
                      <span className="material-symbols-outlined text-[#135bec] text-[20px] font-black">check</span>
                      <span className="text-left">{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={plan.buttonAction}
                  className={`w-full py-4 rounded-full border-2 font-black text-xs uppercase tracking-widest transition-all transform active:scale-95 ${plan.isPopular
                      ? 'bg-[#135bec] text-white border-transparent shadow-xl shadow-blue-500/30'
                      : 'bg-transparent border-[#135bec] text-[#135bec] hover:bg-blue-50'
                    }`}
                >
                  {plan.buttonText}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-4">
          <p className="text-white text-sm font-black tracking-widest uppercase mb-1 drop-shadow-sm">by Madiba Tech</p>
          <p className="text-white/70 text-xs font-bold tracking-tight">tech@madib.com.ar</p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
