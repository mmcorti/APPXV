
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GameGallery } from '../components/GameGallery';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: 'INVITADO GENERAL',
      price: 'Free',
      features: [
        '1 Evento',
        '40 Invitados',
        'Mesas Ilimitadas',
        'Invitaciones Digitales Ilimitadas',
        '3 Staff',
        'Control Hasta 10 Gastos, 3 Proveedores, 2 participantes',
        'FotoWall Básico (20 fotos)',
        'Moderación Manual'
      ],
      buttonText: 'EMPEZAR GRATIS',
      buttonAction: () => navigate('/login'),
      color: 'bg-slate-700',
      textColor: 'text-slate-500',
      isPopular: false
    },
    {
      name: 'INVITADO ESPECIAL',
      price: '$25.000',
      features: [
        '5 Eventos',
        '100 Invitados',
        'Mesas Ilimitadas',
        'Invitaciones Digitales Ilimitadas',
        '20 Staff',
        'Control Hasta 50 Gastos, 20 Proveedores, 10 participantes',
        'FotoWall Pro (200 fotos)',
        'Uso de IA en Games Sí'
      ],
      buttonText: 'ELEGIR ESPECIAL',
      buttonAction: () => navigate('/login'),
      color: 'bg-gradient-to-br from-blue-600 to-indigo-700',
      textColor: 'text-blue-900',
      isPopular: true
    },
    {
      name: 'INVITADO VIP',
      price: '$75.000',
      features: [
        '20 Eventos',
        '200 Invitados',
        'Mesas Ilimitadas',
        'Invitaciones Digitales Ilimitadas',
        '50 Staff',
        'Hasta 500 Gastos, 50 Proveedores, 50 participantes',
        'FotoWall Premium (500 fotos)',
        'Moderación Automática IA'
      ],
      buttonText: 'ELEGIR VIP',
      buttonAction: () => navigate('/login'),
      color: 'bg-gradient-to-br from-amber-400 to-orange-600',
      textColor: 'text-amber-600',
      isPopular: false
    },
    {
      name: 'INVITADO DE HONOR',
      price: 'Contáctanos',
      features: [
        '100 Eventos',
        '1.000 Invitados',
        'Mesas Ilimitadas',
        'Invitaciones Digitales Ilimitadas',
        '100 Staff',
        'Control Ilimitado',
        'FotoWall Ultra (2.000 fotos)',
        'Moderación Automática IA',
        'Uso de IA en Games Sí'
      ],
      buttonText: 'CONTACTAR AHORA',
      buttonAction: () => window.location.href = 'mailto:tech@madiba.com.ar',
      color: 'bg-gradient-to-br from-purple-600 to-fuchsia-700',
      textColor: 'text-purple-700',
      isPopular: false
    },
  ];

  return (
    <div className="relative min-h-screen w-full font-display items-center overflow-x-hidden bg-slate-950">
      {/* HEROS SECTION */}
      <section className="relative h-screen flex flex-col items-center justify-center p-6 bg-slate-900 border-b border-white/5">
        {/* Background Image with Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center z-0 opacity-40 brightness-50"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=1600")' }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950"></div>
        </div>

        {/* Main Hero Card */}
        <div className="relative z-10 w-full max-w-[440px] p-12 flex flex-col items-center justify-center rounded-[50px] bg-white/5 backdrop-blur-3xl border border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
          <div className="mb-10 scale-125">
            <img
              src="/logo.png"
              alt="APPXV Logo"
              className="w-[320px] h-auto drop-shadow-[0_0_30px_rgba(59,130,246,0.3)]"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {!document.querySelector('img[src="/logo.png"]')
            }
          </div>

          <p className="text-white/60 text-center mb-8 font-medium text-base md:text-xl leading-relaxed">La plataforma inteligente para eventos extraordinarios.</p>

          <button
            onClick={() => navigate('/login')}
            className="w-full py-4 px-8 rounded-full bg-primary text-white font-black text-lg shadow-[0_15px_30px_rgba(19,91,236,0.3)] hover:scale-105 transition-all transform active:scale-95 border-2 border-white/20"
          >
            Viví la Experiencia Ahora
          </button>

          <div className="mt-6 flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-widest">

            Desliza para ver más
          </div>
        </div>
      </section>

      {/* GAMES GALLERY COMPONENT */}
      <GameGallery />

      {/* LOGISTICS FEATURE SECTION (Brief Mention) */}
      <section className="py-24 px-6 bg-slate-900 overflow-hidden relative border-y border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 space-y-8">
            <h2 className="text-4xl md:text-5xl font-black text-white italic uppercase tracking-tighter">
              Organización <span className="text-emerald-400">Sin Stress</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              No solo entretenemos a tus invitados. Te damos las herramientas para que la planificación sea tan divertida como la fiesta misma.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: 'payments', text: 'Control de Gastos' },
                { icon: 'description', text: 'Invitaciones Digitales' },
                { icon: 'group_add', text: 'Gestión de Invitados' },
                { icon: 'table_restaurant', text: 'Diagrama de Mesas' },
                { icon: 'support_agent', text: 'Gestión de Staff' },
                { icon: 'inventory_2', text: 'Lista de Regalos' }
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <span className="material-symbols-outlined text-emerald-400">{f.icon}</span>
                  <span className="text-white font-bold text-sm">{f.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 relative">
            <div className="absolute inset-0 bg-emerald-500/20 blur-[100px] rounded-full scale-75 animate-pulse"></div>
            <img
              src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=1000"
              className="relative z-10 rounded-[40px] shadow-2xl border border-white/10"
              alt="Logistics"
            />
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section className="py-24 px-6 bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter mb-4">Planes adaptados a tus invitados</h2>
            <p className="text-slate-500 text-lg">Escoge el plan ideal según el <span className="text-white font-bold">tipo de invitados</span> en tu evento.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, idx) => (
              <div
                key={idx}
                className={`relative bg-white rounded-[40px] flex flex-col shadow-2xl transition-all duration-300 hover:scale-[1.02] ${plan.isPopular ? 'ring-[4px] ring-[#135bec] border-transparent' : 'border border-slate-100'}`}
              >
                <div className={`${plan.color} py-8 px-4 text-center shadow-inner relative overflow-hidden rounded-t-[40px]`}>
                  {plan.isPopular && (
                    <>
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-white px-5 py-1 rounded-b-xl shadow-xl z-20 flex items-center gap-1 border-x border-b border-slate-100">
                        <span className="material-symbols-outlined text-[12px] text-primary font-black">star</span>
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">Más Elegido</span>
                      </div>
                      <div className="mt-4">
                        <h3 className="text-white text-lg font-black tracking-tight">{plan.name}</h3>
                        <p className="text-white/80 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Más Elegido</p>
                      </div>
                    </>
                  )}
                  {!plan.isPopular && (
                    <h3 className="text-white text-lg font-black tracking-tight">{plan.name}</h3>
                  )}
                </div>

                <div className="p-10 flex-1 flex flex-col items-center">
                  <p className={`text-4xl font-black mb-8 tracking-tighter ${plan.textColor}`}>{plan.price}</p>

                  <ul className="space-y-4 mb-10 w-full">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-4 text-sm font-bold text-slate-600 leading-tight">
                        <span className="material-symbols-outlined text-primary text-[20px] font-black">check_circle</span>
                        <span className="text-left">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={plan.buttonAction}
                    className={`w-full py-4 rounded-[24px] font-black text-sm uppercase tracking-wider transition-all transform active:scale-95 ${plan.isPopular
                      ? 'bg-blue-600 text-white shadow-[0_10px_20px_rgba(37,99,235,0.3)]'
                      : 'bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200'
                      }`}
                  >
                    {plan.buttonText}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section >

      {/* FOOTER */}
      < footer className="py-12 px-6 bg-slate-900 border-t border-white/5 text-center" >
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-6">
          <img src="/Logo Madiba Tech.jpg" className="h-12 w-auto opacity-50 grayscale" alt="Logo Footer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div className="space-y-2">
            <p className="text-white text-sm font-black tracking-[0.3em] uppercase opacity-40">by Madiba Tech</p>
            <p className="text-white/30 text-xs font-bold">© 2026 APPXV. Todos los derechos reservados.</p>
            <p className="text-primary text-xs font-bold hover:underline cursor-pointer mt-2">tech@madiba.com.ar</p>
          </div>
        </div>
      </footer >
    </div >
  );
};

export default WelcomeScreen;
