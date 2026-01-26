
import React from 'react';
import { motion } from 'framer-motion';

interface GameItem {
    id: string;
    title: string;
    tagline: string;
    description: string;
    icon: string;
    color: string;
    image: string;
}

const games: GameItem[] = [
    {
        id: 'bingo',
        title: 'Photo Bingo',
        tagline: 'El desafío visual',
        description: 'Transforma la cámara de tus invitados en un tablero de juego. Deben capturar momentos específicos para completar su cartón en tiempo real.',
        icon: 'photo_camera',
        color: 'from-pink-500 to-purple-600',
        image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&q=80&w=1000'
    },
    {
        id: 'impostor',
        title: 'El Impostor',
        tagline: 'Miente para ganar',
        description: 'Un juego social de deducción y roles ocultos. Los invitados votan desde su móvil mientras la tensión sube en la pantalla gigante.',
        icon: 'group_work',
        color: 'from-indigo-600 to-blue-700',
        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=1000'
    },
    {
        id: 'trivia',
        title: 'Trivia Live',
        tagline: 'Adrenalina pura',
        description: 'Pon a prueba a tus invitados con preguntas personalizadas sobre el anfitrión. Podio automático y efectos visuales de alta gama.',
        icon: 'quiz',
        color: 'from-amber-400 to-orange-600',
        image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1000'
    },
    {
        id: 'sorteo',
        title: 'Sorteos Pro',
        tagline: 'Suspenso garantizado',
        description: 'Sistema de rifas digital con animaciones cinematográficas. La forma más emocionante de entregar premios en tu evento.',
        icon: 'celebration',
        color: 'from-emerald-400 to-teal-600',
        image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=1000'
    },
    {
        id: 'confesiones',
        title: 'Muro de Confesiones',
        tagline: 'Mensajes al aire',
        description: 'Espacio anónimo para que los invitados compartan anécdotas, saludos y confesiones que rotan en vivo por la pantalla.',
        icon: 'chat',
        color: 'from-rose-500 to-red-600',
        image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=1000'
    },
    {
        id: 'fotowall',
        title: 'Social FotoWall',
        tagline: 'Tu fiesta en vivo',
        description: 'Streaming instantáneo de las fotos que los invitados suben, creando un álbum colectivo proyectado durante todo el evento.',
        icon: 'perm_media',
        color: 'from-blue-500 to-cyan-600',
        image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&q=80&w=1000'
    }
];

export const GameGallery: React.FC = () => {
    return (
        <section className="bg-slate-950 py-24 px-6 overflow-hidden relative">
            {/* Ambient Background Lights */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 blur-[120px] rounded-full -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full translate-y-1/2"></div>

            <div className="max-w-7xl mx-auto relative z-10">
                <div className="text-center mb-20">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6 italic uppercase"
                    >
                        Diversión <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">Sincronizada</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-slate-400 text-xl max-w-2xl mx-auto font-medium"
                    >
                        Nuestra suite de juegos interactivos transforma a los invitados de espectadores pasivos en protagonistas del evento.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {games.map((game, idx) => (
                        <motion.div
                            key={game.id}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1 }}
                            whileHover={{ y: -10 }}
                            className="group relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 overflow-hidden flex flex-col h-full"
                        >
                            {/* Card Background Glow */}
                            <div className={`absolute -inset-1 bg-gradient-to-br ${game.color} opacity-0 group-hover:opacity-10 transition-opacity blur-2xl`}></div>

                            {/* Game Image Preview */}
                            <div className="relative h-48 mb-8 rounded-3xl overflow-hidden border border-white/5">
                                <img
                                    src={game.image}
                                    className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-500 group-hover:scale-110"
                                    alt={game.title}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>

                                {/* Floating Icon */}
                                <div className={`absolute bottom-4 left-4 p-3 rounded-2xl bg-gradient-to-br ${game.color} shadow-lg shadow-black/50`}>
                                    <span className="material-symbols-outlined text-white text-2xl font-bold">
                                        {game.icon}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4 flex-1">
                                <div className="space-y-1">
                                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] bg-clip-text text-transparent bg-gradient-to-r ${game.color}`}>
                                        {game.tagline}
                                    </span>
                                    <h3 className="text-2xl font-bold text-white tracking-tight">{game.title}</h3>
                                </div>

                                <p className="text-slate-400 text-sm leading-relaxed">
                                    {game.description}
                                </p>
                            </div>

                            {/* View Details Button (Fake for marketing) */}
                            <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">3 Vistas: Mobile, TV & Admin</span>
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse delay-150"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-pulse delay-300"></div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Bottom CTA */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="mt-20 text-center"
                >
                    <button className="bg-white text-slate-950 font-black px-12 py-5 rounded-full text-lg uppercase tracking-wider hover:bg-primary hover:text-white transition-all transform active:scale-95 shadow-2xl shadow-white/5">
                        Ver Demo en Vivo
                    </button>
                </motion.div>
            </div>

            {/* Floating Elements for aesthetics */}
            <div className="absolute top-1/4 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -z-10 animate-pulse"></div>
            <div className="absolute top-3/4 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] -z-10"></div>
        </section>
    );
};
