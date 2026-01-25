
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { confessionsService, ConfessionsState, ConfessionMessage } from '../services/confessionsService';

// Helper to generate consistent positions based on ID
const getPosition = (id: string) => {
    // Simple hash to seed
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Random-ish but deterministic based on ID
    const r1 = Math.abs(Math.sin(hash) * 10000) % 1;
    const r2 = Math.abs(Math.cos(hash) * 10000) % 1;

    // Keep within central 70% of screen to avoid edges
    const top = 15 + (r1 * 60) + '%';
    const left = 10 + (r2 * 60) + '%';

    return { top, left };
};

const ConfessionsBigScreen: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [state, setState] = useState<ConfessionsState | null>(null);
    const [newMsgId, setNewMsgId] = useState<string | null>(null);

    // Audio ref for notification sound
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!id) return;

        // Initial fetch
        confessionsService.getState(id).then(setState);

        // Subscribe
        const unsubscribe = confessionsService.subscribe(id, (newState) => {
            setState(prev => {
                // Check for new messages to trigger sound/animation
                if (prev && newState.messages.length > prev.messages.length) {
                    const lastMsg = newState.messages[newState.messages.length - 1];
                    setNewMsgId(lastMsg.id);
                    // Play sound
                    /* 
                    if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        audioRef.current.play().catch(e => console.log('Audio play failed', e));
                    }
                    */
                    // Remove highlight after 3s
                    setTimeout(() => setNewMsgId(null), 3000);
                }
                return newState;
            });
        });

        return () => unsubscribe();
    }, [id]);

    if (!state) return <div className="bg-black h-screen w-screen flex items-center justify-center text-white">Loading...</div>;

    // Get Guest URL (current URL replace /confessions/ID/screen with /confessions/ID/guest)
    const guestUrl = window.location.href.replace('screen', 'guest');

    return (
        <div className="relative h-screen w-full overflow-hidden bg-black text-white font-display">
            {/* Background */}
            <div className="absolute inset-0 z-0 opacity-40 blur-sm scale-105" style={{
                backgroundImage: `url("${state.backgroundUrl}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }}></div>

            {/* Content Grid */}
            <div className="relative z-10 w-full h-full grid grid-cols-12 p-6 gap-6">

                {/* Center: Chaotic Post-its */}
                <div className="col-span-9 relative border-r border-white/10">
                    <div className="absolute top-0 left-0 p-4 bg-black/30 backdrop-blur-md rounded-xl border border-white/10">
                        <h1 className="text-3xl font-bold tracking-tight text-white/90">Confessions <span className="text-pink-500">Live</span></h1>
                        <p className="text-white/50 text-sm">Send your secret anonymously</p>
                    </div>

                    {state.messages.map((msg) => {
                        const pos = getPosition(msg.id);
                        const isNew = newMsgId === msg.id;
                        return (
                            <div
                                key={msg.id}
                                className={`absolute p-6 w-64 md:w-80 shadow-2xl transition-all duration-700 ease-out flex flex-col justify-center items-center text-center
                                    ${isNew ? 'scale-125 z-50 animate-bounce' : 'scale-100 hover:scale-110 hover:z-40 z-0'}
                                `}
                                style={{
                                    top: pos.top,
                                    left: pos.left,
                                    transform: `rotate(${msg.rotate})`,
                                    backgroundColor: msg.color,
                                    color: '#1a1a1a',
                                    fontFamily: '"Indie Flower", "Comic Sans MS", cursive', // Handwritten vibe
                                    boxShadow: '4px 4px 15px rgba(0,0,0,0.3)'
                                }}
                            >
                                {/* Tape effect */}
                                <div className="absolute -top-3 w-16 h-8 bg-white/30 skew-x-12 backdrop-blur-sm"></div>

                                <p className="text-xl md:text-2xl font-bold leading-tight mb-2 break-words w-full">
                                    {msg.text}
                                </p>
                                <p className="text-xs font-mono uppercase tracking-widest opacity-60 mt-2">
                                    - {msg.author || 'Anonymous'}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Right Sidebar: Chat & QR */}
                <div className="col-span-3 flex flex-col gap-6 h-full">

                    {/* QR Card */}
                    <div className="bg-white/10 backdrop-blur-xl p-6 rounded-3xl border border-white/20 flex flex-col items-center flex-shrink-0 shadow-2xl">
                        <h2 className="text-pink-400 font-bold uppercase tracking-widest text-sm mb-4 animate-pulse">Scan to Confess</h2>
                        <div className="bg-white p-3 rounded-2xl shadow-lg">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(guestUrl)}`}
                                alt="QR Code"
                                className="w-full h-full"
                            />
                        </div>
                        <p className="text-white/60 text-xs mt-4 text-center">No login required. 100% Anonymous.</p>
                    </div>

                    {/* Chat Feed */}
                    <div className="flex-1 bg-black/40 backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-white/5 bg-white/5">
                            <h3 className="font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-pink-500">forum</span>
                                Live Feed
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
                            {state.messages.slice().reverse().map((msg) => (
                                <div key={msg.id} className="bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0" style={{ backgroundColor: msg.color }}>
                                            {msg.author.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium leading-snug">{msg.text}</p>
                                            <p className="text-[10px] text-white/40 mt-1">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfessionsBigScreen;
