import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    triviaService,
    getStoredState,
    TriviaGameState,
    TriviaPlayer,
    OptionKey,
} from '../services/triviaService';

const PLAYER_ID_KEY = 'trivia_player_id';
const PLAYER_NAME_KEY = 'trivia_player_name';

const TriviaGuest: React.FC = () => {
    const { id: eventId } = useParams<{ id: string }>();
    const [gameState, setGameState] = useState<TriviaGameState | null>(null);
    const [playerId, setPlayerId] = useState<string | null>(localStorage.getItem(`${PLAYER_ID_KEY}_${eventId}`));
    const [playerName, setPlayerName] = useState<string>(localStorage.getItem(`${PLAYER_NAME_KEY}_${eventId}`) || '');
    const [inputName, setInputName] = useState('');
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if (!eventId) return;
        const unsubscribe = triviaService.subscribe(eventId, setGameState);
        return unsubscribe;
    }, [eventId]);

    // Timer Sync
    useEffect(() => {
        if (!gameState || !eventId) return;

        const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
        if (!currentQuestion || !gameState.questionStartTime || gameState.status !== 'PLAYING') {
            setTimeLeft(0);
            return;
        }

        const interval = setInterval(() => {
            const elapsed = (Date.now() - gameState.questionStartTime!) / 1000;
            const remaining = Math.max(0, Math.ceil(currentQuestion.durationSeconds - elapsed));
            setTimeLeft(remaining);
            if (remaining <= 0) clearInterval(interval);
        }, 200);

        return () => clearInterval(interval);
    }, [gameState?.currentQuestionIndex, gameState?.questionStartTime, eventId]);

    const handleJoin = async () => {
        if (!inputName.trim() || !eventId) return;
        const newId = crypto.randomUUID();
        localStorage.setItem(`${PLAYER_ID_KEY}_${eventId}`, newId);
        localStorage.setItem(`${PLAYER_NAME_KEY}_${eventId}`, inputName);
        setPlayerId(newId);
        setPlayerName(inputName);
        await triviaService.joinPlayer(eventId, newId, inputName);
    };

    const handleAnswer = async (option: OptionKey) => {
        if (!playerId || !eventId || !gameState) return;
        const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
        if (!currentQuestion || timeLeft <= 0) return;
        await triviaService.submitAnswer(eventId, playerId, currentQuestion.id, option);
    };

    if (!eventId || !gameState) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const currentQuestion = gameState.currentQuestionIndex >= 0
        ? gameState.questions[gameState.currentQuestionIndex]
        : null;
    const player = playerId ? gameState.players[playerId] : null;
    const hasAnswered = playerId && currentQuestion && player?.answers[currentQuestion.id];
    const isTimeUp = timeLeft === 0 && gameState.status === 'PLAYING' && !!currentQuestion;

    // === JOIN SCREEN ===
    if (!playerId) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col justify-center p-8 text-center">
                <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-500 mb-2">
                    Trivia
                </h1>
                <p className="text-slate-400 mb-8">Ingresa tu nombre para unirte</p>
                <input
                    type="text"
                    placeholder="Tu nombre"
                    className="bg-slate-800 border border-slate-600 rounded-xl p-4 text-xl text-center text-white mb-4 focus:outline-none focus:border-pink-500"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    maxLength={20}
                    autoFocus
                />
                <button
                    onClick={handleJoin}
                    disabled={!inputName.trim()}
                    className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-xl shadow-lg transition-all active:scale-95"
                >
                    UNIRME
                </button>
            </div>
        );
    }

    // === WAITING SCREEN ===
    if (gameState.status === 'WAITING' || (gameState.status === 'PLAYING' && !currentQuestion)) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
                <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-8" />
                <h2 className="text-2xl font-bold text-white mb-2">¡Ya estás dentro!</h2>
                <p className="text-slate-400">Esperando a que empiece el juego...</p>
                <div className="mt-8 bg-slate-800 p-4 rounded-xl w-full max-w-xs text-center">
                    <p className="text-sm text-slate-500">Jugando como</p>
                    <p className="text-xl font-bold text-white">{playerName}</p>
                </div>
            </div>
        );
    }

    // === FINISHED SCREEN ===
    if (gameState.status === 'FINISHED') {
        const players = Object.values(gameState.players) as TriviaPlayer[];
        const rank = players.sort((a, b) => b.score - a.score).findIndex((p) => p.id === playerId) + 1;

        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
                <h2 className="text-3xl font-bold text-white mb-6">¡Juego Terminado!</h2>
                <div className="bg-slate-800 p-8 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-700">
                    <p className="text-slate-400 uppercase text-sm font-bold tracking-wider mb-2">Tu Puntaje</p>
                    <p className="text-6xl font-black text-green-400 mb-6">{player?.score || 0}</p>
                    <div className="h-px bg-slate-700 w-full mb-6" />
                    <p className="text-slate-400">Posición</p>
                    <p className="text-3xl font-bold text-white">
                        {rank === 1 && '🥇 '}
                        {rank === 2 && '🥈 '}
                        {rank === 3 && '🥉 '}
                        #{rank}
                    </p>
                </div>
            </div>
        );
    }

    // === QUESTION ACTIVE ===
    if (currentQuestion) {
        const optionColors = [
            'bg-red-600 hover:bg-red-500',
            'bg-blue-600 hover:bg-blue-500',
            'bg-amber-500 hover:bg-amber-400',
            'bg-green-600 hover:bg-green-500',
        ];

        return (
            <div className="min-h-screen bg-slate-950 flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-4 bg-slate-900 border-b border-slate-800">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        {playerName}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-pink-400 font-bold">{player?.score || 0} pts</span>
                    </div>
                </div>

                {/* Timer */}
                <div className="px-4 pt-4">
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-200 ${timeLeft < 5 ? 'bg-red-500' : 'bg-green-500'
                                }`}
                            style={{ width: `${(timeLeft / currentQuestion.durationSeconds) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1 text-sm">
                        <span className="text-slate-500">Pregunta {gameState.currentQuestionIndex + 1}/{gameState.questions.length}</span>
                        <span className={`font-mono font-bold ${timeLeft < 5 ? 'text-red-500' : 'text-white'}`}>
                            {timeLeft}s
                        </span>
                    </div>
                </div>

                {/* Question */}
                <div className="p-4 flex-shrink-0">
                    <h2 className="text-xl font-bold leading-snug text-white">
                        {currentQuestion.text}
                    </h2>

                    {isTimeUp && !gameState.isAnswerRevealed && (
                        <div className="mt-3 p-3 bg-slate-800 rounded-lg text-center text-slate-400 text-sm">
                            ¡Tiempo! Esperando revelar...
                        </div>
                    )}

                    {gameState.isAnswerRevealed && (
                        <div className="mt-3 p-3 rounded-lg text-center font-bold">
                            {hasAnswered === currentQuestion.correctOption ? (
                                <span className="text-green-400">✓ ¡Correcto! +1 punto</span>
                            ) : (
                                <span className="text-red-400">✗ Incorrecto. Era: {currentQuestion.correctOption}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Answer Grid */}
                <div className="p-4 grid grid-cols-2 gap-3 flex-1">
                    {currentQuestion.options.map((opt, idx) => {
                        const isSelected = hasAnswered === opt.key;
                        const isDisabled = !!hasAnswered || isTimeUp || gameState.isAnswerRevealed;
                        const isCorrect = opt.key === currentQuestion.correctOption;

                        let btnClass = optionColors[idx];

                        if (isSelected) {
                            btnClass = 'bg-indigo-600 ring-4 ring-indigo-400/50';
                        }

                        if (gameState.isAnswerRevealed) {
                            if (isCorrect) {
                                btnClass = 'bg-green-500 ring-4 ring-green-400/50';
                            } else if (isSelected) {
                                btnClass = 'bg-red-500 opacity-60';
                            } else {
                                btnClass = 'bg-slate-700 opacity-30';
                            }
                        }

                        return (
                            <button
                                key={opt.key}
                                onClick={() => handleAnswer(opt.key)}
                                disabled={isDisabled}
                                className={`
                  flex flex-col items-center justify-center rounded-xl p-4 transition-all duration-200 active:scale-95
                  ${btnClass}
                  ${isDisabled && !gameState.isAnswerRevealed ? 'opacity-70 cursor-not-allowed' : ''}
                `}
                            >
                                <span className="text-3xl font-black mb-1">{opt.key}</span>
                                <span className="text-sm font-medium text-center leading-tight opacity-90 line-clamp-2">
                                    {opt.text}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    return null;
};

export default TriviaGuest;
