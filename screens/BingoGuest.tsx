import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { bingoService, BingoGameState, BingoPrompt } from '../services/bingoService';
import { BingoCard } from '../types/bingoTypes';

const PLAYER_ID_KEY = 'bingo_player_id';
const PLAYER_NAME_KEY = 'bingo_player_name';

const BingoGuest: React.FC = () => {
    const { id: eventId } = useParams<{ id: string }>();
    const [state, setState] = useState<BingoGameState | null>(null);
    const [playerName, setPlayerName] = useState('');
    const [isRegistered, setIsRegistered] = useState(false);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [card, setCard] = useState<BingoCard | null>(null);
    const [activePrompt, setActivePrompt] = useState<BingoPrompt | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!eventId) return;

        // Check for existing session
        const savedPlayerId = sessionStorage.getItem(`${PLAYER_ID_KEY}_${eventId}`);
        const savedPlayerName = sessionStorage.getItem(`${PLAYER_NAME_KEY}_${eventId}`);
        if (savedPlayerId && savedPlayerName) {
            setPlayerId(savedPlayerId);
            setPlayerName(savedPlayerName);
            setIsRegistered(true);
        }

        // Subscribe to real-time updates
        const unsubscribe = bingoService.subscribe(eventId, (newState) => {
            setState(newState);
            // Update local card from state
            if (savedPlayerId && newState.cards[savedPlayerId]) {
                setCard(newState.cards[savedPlayerId]);
            }
        });

        return unsubscribe;
    }, [eventId]);

    // Update card when playerId is set
    useEffect(() => {
        if (state && playerId && state.cards[playerId]) {
            setCard(state.cards[playerId]);
        }
    }, [state, playerId]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!playerName.trim() || !eventId) return;

        setIsLoading(true);
        setError(null);

        try {
            const result = await bingoService.joinPlayer(eventId, playerName);
            sessionStorage.setItem(`${PLAYER_ID_KEY}_${eventId}`, result.player.id);
            sessionStorage.setItem(`${PLAYER_NAME_KEY}_${eventId}`, playerName);
            setPlayerId(result.player.id);
            setIsRegistered(true);
        } catch (err: any) {
            setError(err.message || 'Error al unirse al juego');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCellClick = (prompt: BingoPrompt) => {
        if (!state || state.status !== 'PLAYING') return;
        if (card?.submittedAt) return; // Prevent editing after submit
        setActivePrompt(prompt);
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 100);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0] || !activePrompt || !playerId || !eventId) return;

        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = async (ev) => {
            const photoUrl = ev.target?.result as string;
            try {
                await bingoService.uploadPhoto(eventId, playerId, activePrompt.id, photoUrl);
                setActivePrompt(null);
            } catch (err: any) {
                setError(err.message || 'Error al subir foto');
            }
        };

        reader.readAsDataURL(file);
        e.target.value = ''; // Reset input
    };

    const handleSubmit = async () => {
        if (!playerId || !eventId) return;

        if (!confirm('¿Estás seguro? No podrás cambiar las fotos después de enviar.')) {
            return;
        }

        setIsLoading(true);
        try {
            await bingoService.submitCard(eventId, playerId);
        } catch (err: any) {
            setError(err.message || 'Error al enviar cartón');
        } finally {
            setIsLoading(false);
        }
    };

    // Loading state
    if (!state) {
        return (
            <div className="min-h-screen bg-indigo-500 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
        );
    }

    // Registration Screen
    if (!isRegistered) {
        return (
            <div className="min-h-screen bg-indigo-500 flex items-center justify-center p-6 font-sans">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
                    <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl">photo_camera</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Photo Bingo</h1>
                    <p className="text-gray-500 mb-6 text-sm">¡Ingresa tu nombre para jugar!</p>

                    {error && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleRegister}>
                        <input
                            type="text"
                            className="w-full border-2 border-gray-200 rounded-xl p-3 text-center text-lg focus:border-indigo-500 focus:outline-none mb-4"
                            placeholder="Tu Nombre"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !playerName.trim()}
                            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
                        >
                            {isLoading ? 'Cargando...' : '¡Vamos a Jugar!'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Waiting Room
    if (state.status === 'WAITING') {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center font-sans">
                <div className="animate-bounce mb-4 text-6xl">⏳</div>
                <h2 className="text-xl font-bold mb-2">¡Hola, {playerName}!</h2>
                <p className="text-gray-500">Esperando que el host inicie el juego.</p>
                <div className="mt-8 p-4 bg-gray-50 rounded-xl text-sm text-gray-400">
                    Tip: ¡Asegúrate de tener la cámara lista!
                </div>
            </div>
        );
    }

    // Winner Screen (for guest)
    if (state.status === 'WINNER' && state.winner) {
        const isWinner = state.winner.player.id === playerId;
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center p-8 text-center font-sans ${isWinner ? 'bg-gradient-to-b from-yellow-400 to-orange-500' : 'bg-gray-100'}`}>
                {isWinner ? (
                    <>
                        <div className="text-8xl mb-4">🏆</div>
                        <h1 className="text-4xl font-black text-white mb-2">¡GANASTE!</h1>
                        <p className="text-xl text-white/80">
                            {state.winner.type === 'BINGO' ? '¡Bingo Completo!' : '¡Línea Completada!'}
                        </p>
                    </>
                ) : (
                    <>
                        <div className="text-6xl mb-4">🎉</div>
                        <h1 className="text-2xl font-bold text-gray-800 mb-2">¡Juego Terminado!</h1>
                        <p className="text-gray-600 mb-4">El ganador es...</p>
                        <p className="text-3xl font-black text-indigo-600">{state.winner.player.name}</p>
                    </>
                )}
            </div>
        );
    }

    // Game Grid
    const cellCount = card ? Object.keys(card.cells).length : 0;
    const isEligible = (card?.completedLines || 0) > 0 || card?.isFullHouse;
    const isSubmitted = !!card?.submittedAt;

    return (
        <div className="min-h-screen bg-gray-100 pb-24 font-sans max-w-md mx-auto relative shadow-2xl">
            {/* Header */}
            <header className="bg-indigo-600 text-white p-4 sticky top-0 z-20 shadow-md">
                <div className="flex justify-between items-center">
                    <div className="font-bold text-lg">Photo Bingo</div>
                    <div className="text-xs bg-indigo-500 px-2 py-1 rounded-full">{cellCount}/9 Fotos</div>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-indigo-800 h-1.5 mt-3 rounded-full overflow-hidden">
                    <div
                        className="bg-yellow-400 h-full transition-all duration-500"
                        style={{ width: `${(cellCount / 9) * 100}%` }}
                    ></div>
                </div>
            </header>

            {/* Error Display */}
            {error && (
                <div className="mx-4 mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                    {error}
                    <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
                </div>
            )}

            {/* Submitted Notice */}
            {isSubmitted && (
                <div className="mx-4 mt-4 p-4 bg-green-100 text-green-800 rounded-xl text-center">
                    <span className="material-symbols-outlined text-2xl mb-1">check_circle</span>
                    <p className="font-bold">¡Cartón Enviado!</p>
                    <p className="text-sm">Esperando revisión del host...</p>
                </div>
            )}

            {/* Grid */}
            <div className="p-4 grid grid-cols-3 gap-3">
                {state.prompts.map(prompt => {
                    const cell = card?.cells[prompt.id];
                    const hasPhoto = !!cell?.photoUrl;

                    return (
                        <button
                            key={prompt.id}
                            onClick={() => handleCellClick(prompt)}
                            className={`aspect-square rounded-xl relative overflow-hidden transition-all transform active:scale-95 shadow-sm border-2 
                                ${hasPhoto ? 'border-green-500' : 'border-white bg-white'}
                                ${isSubmitted ? 'pointer-events-none opacity-70' : ''}`}
                            disabled={state.status !== 'PLAYING' || isSubmitted}
                        >
                            {hasPhoto ? (
                                <>
                                    <img src={cell.photoUrl} className="w-full h-full object-cover" alt="Foto" />
                                    <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5 shadow-md">
                                        <span className="material-symbols-outlined text-sm block">check</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full p-1 text-gray-400 hover:bg-gray-50">
                                    <span className="material-symbols-outlined text-3xl mb-1 text-indigo-300">{prompt.icon}</span>
                                    <span className="text-[10px] font-bold text-center leading-tight text-gray-600">{prompt.text}</span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Hidden File Input */}
            <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Footer Action */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-30 max-w-md mx-auto">
                {isSubmitted ? (
                    <div className="bg-yellow-100 text-yellow-800 p-3 rounded-xl text-center font-bold">
                        ⏳ Esperando revisión...
                    </div>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={!isEligible || isLoading}
                        className={`w-full py-3 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2
                            ${isEligible
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                    >
                        {isLoading ? (
                            'Enviando...'
                        ) : isEligible ? (
                            <>
                                <span className="material-symbols-outlined">send</span>
                                ¡Enviar Cartón!
                            </>
                        ) : (
                            'Completa una línea para enviar'
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default BingoGuest;
