import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    triviaService,
    getStoredState,
    TriviaGameState,
    TriviaQuestion,
    OptionKey,
} from '../services/triviaService';
import { User } from '../types';
import { notionService } from '../services/notion';

interface TriviaAdminProps {
    user: User;
}

const TriviaAdmin: React.FC<TriviaAdminProps> = ({ user }) => {
    const { id: eventId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [gameState, setGameState] = useState<TriviaGameState | null>(null);

    // Question form
    const [showQuestionForm, setShowQuestionForm] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<TriviaQuestion | null>(null);
    const [questionText, setQuestionText] = useState('');
    const [optionA, setOptionA] = useState('');
    const [optionB, setOptionB] = useState('');
    const [optionC, setOptionC] = useState('');
    const [optionD, setOptionD] = useState('');
    const [correctOption, setCorrectOption] = useState<OptionKey>('A');
    const [duration, setDuration] = useState(10);
    const [bgUrl, setBgUrl] = useState('');

    const [activeTab, setActiveTab] = useState<'LIVE' | 'CONFIG'>('LIVE');
    const [uploading, setUploading] = useState(false);

    // AI Generation
    const [aiTheme, setAiTheme] = useState('');
    const [aiCount, setAiCount] = useState(5);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    // Auto Mode
    const [isAutoEnabled, setIsAutoEnabled] = useState(false);

    useEffect(() => {
        if (!eventId) return;
        const unsubscribe = triviaService.subscribe(eventId, (state) => {
            setGameState(state);
            setBgUrl(state.backgroundUrl || '');
        });
        return unsubscribe;
    }, [eventId]);

    if (!eventId || !gameState || !gameState.questions || !gameState.players) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const currentQuestion = (gameState?.questions && gameState.currentQuestionIndex >= 0)
        ? gameState.questions[gameState.currentQuestionIndex]
        : null;
    const totalPlayers = gameState?.players ? Object.keys(gameState.players).length : 0;

    const resetForm = () => {
        setQuestionText('');
        setOptionA('');
        setOptionB('');
        setOptionC('');
        setOptionD('');
        setCorrectOption('A');
        setDuration(10);
        setEditingQuestion(null);
        setShowQuestionForm(false);
    };

    const handleSaveQuestion = async () => {
        if (!questionText.trim() || !optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
            alert('Por favor completa todos los campos');
            return;
        }

        const questionData = {
            text: questionText,
            options: [
                { key: 'A' as OptionKey, text: optionA },
                { key: 'B' as OptionKey, text: optionB },
                { key: 'C' as OptionKey, text: optionC },
                { key: 'D' as OptionKey, text: optionD },
            ],
            correctOption,
            durationSeconds: duration,
        };

        if (editingQuestion) {
            await triviaService.updateQuestion(eventId, editingQuestion.id, questionData);
        } else {
            const result = await triviaService.addQuestion(eventId, questionData, user.plan, user.role);
            if (result.limitReached) {
                alert(result.error);
                return;
            }
        }

        resetForm();
    };

    const handleEditQuestion = (question: TriviaQuestion) => {
        setEditingQuestion(question);
        setQuestionText(question.text);
        setOptionA(question.options[0]?.text || '');
        setOptionB(question.options[1]?.text || '');
        setOptionC(question.options[2]?.text || '');
        setOptionD(question.options[3]?.text || '');
        setCorrectOption(question.correctOption);
        setDuration(question.durationSeconds);
        setShowQuestionForm(true);
    };

    const handleDeleteQuestion = async (questionId: string) => {
        if (window.confirm('¿Eliminar esta pregunta?')) {
            await triviaService.deleteQuestion(eventId, questionId);
        }
    };

    const handleStartGame = async () => {
        if (gameState.questions.length === 0) {
            alert('Necesitas al menos una pregunta para iniciar');
            return;
        }
        await triviaService.startGame(eventId);
    };

    const handleNextQuestion = async () => {
        const success = await triviaService.nextQuestion(eventId);
        if (!success) {
            alert('No hay más preguntas. Finaliza el juego.');
        }
    };

    const handleRevealAnswer = async () => {
        await triviaService.revealAnswer(eventId);
    };

    const handleEndGame = async () => {
        await triviaService.endGame(eventId);
    };

    const handleResetGame = async () => {
        if (window.confirm('¿Reiniciar todo el juego? Se borrarán jugadores y respuestas.')) {
            await triviaService.resetGame(eventId);
        }
    };

    const handleSaveBackground = async (urlOverride?: string) => {
        if (!eventId) return;
        const finalUrl = urlOverride !== undefined ? urlOverride : bgUrl;
        await triviaService.updateConfig(eventId, { backgroundUrl: finalUrl });
        // State will update via SSE
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !eventId) return;

        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                // @ts-ignore
                const url = await notionService.uploadImage(base64);
                setBgUrl(url);
                await handleSaveBackground(url);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error("Upload failed:", err);
            alert("Error al subir la imagen");
        } finally {
            setUploading(false);
        }
    };

    const handleGenerateAI = async () => {
        if (!aiTheme.trim()) {
            alert('Por favor ingresa una temática');
            return;
        }

        setIsGeneratingAI(true);
        try {
            const result = await triviaService.generateQuestions(aiTheme, aiCount);
            if (result.success && Array.isArray(result.questions)) {
                let addedCount = 0;
                let limitReached = false;

                for (const q of result.questions) {
                    const saveResult = await triviaService.addQuestion(eventId!, q, user.plan, user.role);
                    if (saveResult.limitReached) {
                        limitReached = true;
                        break;
                    }
                    addedCount++;
                }

                if (limitReached) {
                    alert(`Se agregaron ${addedCount} preguntas, pero se alcanzó el límite de tu plan.`);
                } else {
                    alert(`¡Éxito! Se generaron y agregaron ${addedCount} preguntas.`);
                }
                setAiTheme('');
            } else {
                alert('Error al generar preguntas. Intenta con otra temática.');
            }
        } catch (error) {
            console.error('AI Generation failed:', error);
            alert('Error de conexión con el servicio de IA.');
        } finally {
            setIsGeneratingAI(false);
        }
    };


    // Auto Mode Logic
    useEffect(() => {
        if (!isAutoEnabled || !gameState || gameState.status !== 'PLAYING') return;

        const timer = setInterval(async () => {
            const now = Date.now();
            const currentQ = gameState.questions[gameState.currentQuestionIndex];

            if (!currentQ) {
                if (gameState.currentQuestionIndex === -1) {
                    await handleNextQuestion();
                }
                return;
            }

            const endTime = (gameState.questionStartTime || 0) + (currentQ.durationSeconds * 1000);

            if (now > endTime && !gameState.isAnswerRevealed) {
                await handleRevealAnswer();
            } else if (gameState.isAnswerRevealed) {
                // Wait 5 seconds after reveal to show next question
                if (now > endTime + 5000) {
                    const success = await triviaService.nextQuestion(eventId!);
                    if (!success) {
                        setIsAutoEnabled(false);
                        await handleEndGame();
                    }
                }
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [isAutoEnabled, gameState?.status, gameState?.currentQuestionIndex, gameState?.isAnswerRevealed]);

    const qrUrl = `${window.location.origin}/#/trivia/${eventId}/play`;

    return (
        <div className="min-h-screen bg-slate-950 text-white pb-20">
            {/* Header */}
            <header className="bg-slate-900/80 border-b border-slate-800 px-6 py-4 sticky top-0 z-50 backdrop-blur-md">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(`/games/${eventId}`)}
                            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-pink-500">quiz</span>
                                Trivia Admin
                            </h1>
                            <div className="flex items-center gap-2 text-sm">
                                <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${gameState.status === 'PLAYING' ? 'bg-green-600' :
                                        gameState.status === 'FINISHED' ? 'bg-amber-600' : 'bg-slate-600'
                                        }`}
                                >
                                    {gameState.status === 'WAITING' ? 'EN ESPERA' :
                                        gameState.status === 'PLAYING' ? 'EN VIVO' : 'FINALIZADO'}
                                </span>
                                <span className="text-slate-400 font-medium">{totalPlayers} jugadores conectados</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.open(`#/trivia/${eventId}/screen`, '_blank')}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                        >
                            <span className="material-symbols-outlined text-sm">tv</span>
                            Pantalla Gigante
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6">
                {/* Tabs Navigation */}
                <div className="flex gap-8 mb-8 border-b border-slate-800">
                    <button
                        onClick={() => setActiveTab('LIVE')}
                        className={`pb-4 px-2 font-bold transition-all relative ${activeTab === 'LIVE' ? 'text-pink-500' : 'text-slate-500 hover:text-white'}`}
                    >
                        Juego en Vivo
                        {activeTab === 'LIVE' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-pink-500 rounded-t-full" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('CONFIG')}
                        className={`pb-4 px-2 font-bold transition-all relative ${activeTab === 'CONFIG' ? 'text-pink-500' : 'text-slate-500 hover:text-white'}`}
                    >
                        Configuración
                        {activeTab === 'CONFIG' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-pink-500 rounded-t-full" />}
                    </button>
                </div>

                {activeTab === 'LIVE' ? (
                    <div className="animate-fade-in space-y-6">
                        {/* Status Overview Card */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Estado</p>
                                <p className="text-2xl font-black italic uppercase">
                                    {gameState.status === 'WAITING' && 'Esperando Inicio'}
                                    {gameState.status === 'PLAYING' && 'Partida en Curso'}
                                    {gameState.status === 'FINISHED' && 'Juego Finalizado'}
                                </p>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Pregunta Actual</p>
                                <p className="text-2xl font-black italic uppercase">
                                    {gameState.currentQuestionIndex + 1} <span className="text-slate-600">/ {gameState.questions.length}</span>
                                </p>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Jugadores</p>
                                <p className="text-2xl font-black italic uppercase text-pink-500">{totalPlayers}</p>
                            </div>
                        </div>

                        {/* Game Controls Section */}
                        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8 shadow-2xl overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <span className="material-symbols-outlined text-9xl">play_circle</span>
                            </div>

                            <div className="relative z-10">
                                <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                                    <span className="p-2 bg-pink-500/10 rounded-xl">
                                        <span className="material-symbols-outlined text-pink-500">settings_remote</span>
                                    </span>
                                    Panel de Control
                                </h2>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 text-slate-100">
                                    {/* Action Buttons */}
                                    <div className="space-y-4">
                                        {gameState.status === 'WAITING' && (
                                            <button
                                                onClick={handleStartGame}
                                                disabled={gameState.questions.length === 0}
                                                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:grayscale py-6 rounded-2xl font-black text-xl shadow-lg shadow-green-900/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                                            >
                                                <span className="material-symbols-outlined text-3xl">play_arrow</span>
                                                COMENZAR TRIVIA
                                            </button>
                                        )}

                                        {gameState.status === 'PLAYING' && (
                                            <div className="space-y-4">
                                                {gameState.currentQuestionIndex === -1 ? (
                                                    <button
                                                        onClick={handleNextQuestion}
                                                        className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 py-6 rounded-2xl font-black text-xl shadow-lg shadow-indigo-900/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                                                    >
                                                        <span className="material-symbols-outlined text-3xl">rocket_launch</span>
                                                        LANZAR PRIMERA PREGUNTA
                                                    </button>
                                                ) : (
                                                    <div className="grid grid-cols-1 gap-4">
                                                        <button
                                                            onClick={handleRevealAnswer}
                                                            disabled={gameState.isAnswerRevealed}
                                                            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:from-orange-400 disabled:opacity-50 py-6 rounded-2xl font-black text-xl shadow-lg shadow-amber-900/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                                                        >
                                                            <span className="material-symbols-outlined text-3xl">{gameState.isAnswerRevealed ? 'done_all' : 'visibility'}</span>
                                                            {gameState.isAnswerRevealed ? 'RESPUESTA REVELADA' : 'REVELAR RESPUESTA'}
                                                        </button>
                                                        <button
                                                            onClick={handleNextQuestion}
                                                            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 py-6 rounded-2xl font-black text-xl shadow-lg shadow-indigo-900/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                                                        >
                                                            <span className="material-symbols-outlined text-3xl">skip_next</span>
                                                            SIGUIENTE PREGUNTA
                                                        </button>
                                                    </div>
                                                )}

                                                <div className="pt-8 mt-8 border-t border-slate-800 space-y-4">
                                                    <button
                                                        onClick={() => setIsAutoEnabled(!isAutoEnabled)}
                                                        className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border ${isAutoEnabled
                                                            ? 'bg-pink-600/20 border-pink-500 text-pink-500 shadow-lg shadow-pink-500/20'
                                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                                            }`}
                                                    >
                                                        <span className="material-symbols-outlined">{isAutoEnabled ? 'pause_circle' : 'autoplay'}</span>
                                                        {isAutoEnabled ? 'MODO AUTOMÁTICO ACTIVO' : 'ACTIVAR MODO AUTOMÁTICO'}
                                                    </button>

                                                    <button
                                                        onClick={handleEndGame}
                                                        className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-white border border-slate-700"
                                                    >
                                                        <span className="material-symbols-outlined">analytics</span>
                                                        Mostrar Resultados
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {gameState.status === 'FINISHED' && (
                                            <div className="text-center space-y-6 py-8">
                                                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <span className="material-symbols-outlined text-4xl text-amber-500">emoji_events</span>
                                                </div>
                                                <h3 className="text-2xl font-black">¡Trivia Completada!</h3>
                                                <p className="text-slate-400 max-w-xs mx-auto">Revisa el podio en la pantalla gigante.</p>
                                                <button
                                                    onClick={handleResetGame}
                                                    className="w-full bg-red-600 hover:bg-red-500 py-4 rounded-xl font-black shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined">restart_alt</span>
                                                    REINICIAR PARA NUEVA PARTIDA
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Info Panel / Current Question Preview */}
                                    <div className="bg-slate-950/50 rounded-2xl border border-slate-800 p-6 flex flex-col justify-center">
                                        {currentQuestion ? (
                                            <div className="space-y-6">
                                                <div>
                                                    <span className="text-pink-500 text-[10px] font-black uppercase tracking-[0.2em]">En Pantalla</span>
                                                    <h3 className="text-xl font-bold text-white mt-1 leading-tight">{currentQuestion.text}</h3>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {currentQuestion.options.map((opt) => (
                                                        <div
                                                            key={opt.key}
                                                            className={`p-3 rounded-xl border text-sm flex items-center gap-3 ${opt.key === currentQuestion.correctOption
                                                                ? 'bg-green-500/10 border-green-500/50 text-green-400'
                                                                : 'bg-slate-900 border-slate-800 text-slate-400'
                                                                }`}
                                                        >
                                                            <span className="font-black opacity-50">{opt.key}</span>
                                                            <span className="font-medium truncate">{opt.text}</span>
                                                            {opt.key === currentQuestion.correctOption && (
                                                                <span className="material-symbols-outlined text-xs ml-auto">check_circle</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12">
                                                <span className="material-symbols-outlined text-5xl text-slate-800 mb-4">monitor</span>
                                                <p className="text-slate-500 font-medium">No hay una pregunta activa en este momento.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in space-y-8">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Questions Management Column */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-xl">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h2 className="text-xl font-black">Banco de Preguntas</h2>
                                            <p className="text-slate-400 text-sm">{gameState.questions.length} preguntas disponibles</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                resetForm();
                                                setShowQuestionForm(true);
                                            }}
                                            className="flex items-center gap-2 bg-pink-600 hover:bg-pink-500 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-pink-600/20 active:scale-95"
                                        >
                                            <span className="material-symbols-outlined text-sm">add</span>
                                            Agregar Manual
                                        </button>
                                    </div>

                                    {/* AI Generator Block */}
                                    <div className="mb-8 p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                                                <span className="material-symbols-outlined text-white text-sm">psychology</span>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black uppercase tracking-wider text-indigo-400">Generador con IA</h3>
                                                <p className="text-[10px] text-slate-500 font-medium">Crea preguntas automáticas con Gemini AI</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col md:flex-row gap-4 items-end">
                                            <div className="flex-1 space-y-2">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Temática del Evento / Trivia</label>
                                                <input
                                                    type="text"
                                                    value={aiTheme}
                                                    onChange={(e) => setAiTheme(e.target.value)}
                                                    placeholder="Ej: Historia del Rock, Películas de Marvel, Cultura General..."
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                                                />
                                            </div>
                                            <div className="w-full md:w-32 space-y-2">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cantidad</label>
                                                <select
                                                    value={aiCount}
                                                    onChange={(e) => setAiCount(parseInt(e.target.value))}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                                                >
                                                    {[1, 3, 5, 10, 15].map(n => (
                                                        <option key={n} value={n}>{n} {n === 1 ? 'pregunta' : 'preguntas'}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button
                                                onClick={handleGenerateAI}
                                                disabled={isGeneratingAI || !aiTheme.trim()}
                                                className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                                            >
                                                {isGeneratingAI ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                        <span>Generando...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                                        Generar con IA
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Questions List */}
                                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                        {gameState.questions.map((q, idx) => (
                                            <div
                                                key={q.id}
                                                className={`p-4 rounded-2xl border transition-all group ${gameState.currentQuestionIndex === idx
                                                    ? 'border-pink-500 bg-pink-500/5'
                                                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <span className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">#{idx + 1}</span>
                                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{q.durationSeconds}s de tiempo</span>
                                                        </div>
                                                        <h4 className="font-bold text-slate-200">{q.text}</h4>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleEditQuestion(q)}
                                                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">edit</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteQuestion(q.id)}
                                                            className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">delete</span>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="mt-4 grid grid-cols-2 gap-2">
                                                    {q.options.map((opt) => (
                                                        <div
                                                            key={opt.key}
                                                            className={`text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-2 ${opt.key === q.correctOption
                                                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                                                : 'bg-slate-950/50 text-slate-500'
                                                                }`}
                                                        >
                                                            <span className="font-black opacity-50">{opt.key}</span>
                                                            <span className="truncate">{opt.text}</span>
                                                            {opt.key === q.correctOption && <span className="material-symbols-outlined text-[10px] ml-auto">check</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}

                                        {gameState.questions.length === 0 && (
                                            <div className="text-center py-16 bg-slate-950/30 rounded-3xl border border-dashed border-slate-800">
                                                <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <span className="material-symbols-outlined text-3xl text-slate-700">quiz</span>
                                                </div>
                                                <p className="text-slate-500 font-medium">Aún no hay preguntas cargadas</p>
                                                <button
                                                    onClick={() => setShowQuestionForm(true)}
                                                    className="mt-4 text-pink-500 font-bold text-sm hover:underline"
                                                >
                                                    Agregar mi primera pregunta
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sidebar Configuration */}
                            <div className="space-y-6">
                                {/* Guest Simulations / QR */}
                                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-xl">
                                    <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-pink-500">qr_code_2</span>
                                        Acceso Invitados
                                    </h2>
                                    <div className="bg-white p-4 rounded-3xl inline-block mx-auto mb-6 shadow-2xl shadow-indigo-500/20">
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrUrl)}`}
                                            alt="QR Access"
                                            className="w-full aspect-square max-w-[180px]"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <button
                                            onClick={() => window.open(qrUrl, '_blank')}
                                            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 py-4 rounded-2xl font-bold text-sm transition-all"
                                        >
                                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                                            Probar como Invitado
                                        </button>
                                        <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest font-black">
                                            Escanea o usa el botón para simular
                                        </p>
                                    </div>
                                </div>

                                {/* Background Config */}
                                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-xl">
                                    <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-pink-500">image</span>
                                        Personalización
                                    </h2>
                                    <div className="space-y-4">
                                        <div className="aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 relative group">
                                            {bgUrl ? (
                                                <img src={bgUrl} alt="Preview" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 italic text-sm">
                                                    <span className="material-symbols-outlined text-4xl mb-2 opacity-20">add_photo_alternate</span>
                                                    Sin fondo personalizado
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <label className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center gap-2">
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                                                    {uploading ? (
                                                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-sm">upload</span>
                                                    )}
                                                    {uploading ? 'Subiendo...' : 'SUBIR IMAGEN'}
                                                </label>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">URL Directa</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={bgUrl}
                                                    onChange={(e) => setBgUrl(e.target.value)}
                                                    placeholder="https://..."
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-24 py-3 text-sm focus:outline-none focus:border-pink-500 transition-colors font-mono"
                                                />
                                                <button
                                                    onClick={() => handleSaveBackground()}
                                                    className="absolute right-2 top-1.5 h-9 px-4 bg-slate-800 hover:bg-white hover:text-slate-950 text-[10px] font-black rounded-lg transition-all"
                                                >
                                                    APLICAR
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-600 leading-relaxed italic px-1">
                                            Sugerencia: Usa una imagen oscura de 1920x1080 para que las preguntas resalten en la pantalla.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Question Form Modal */}
            {showQuestionForm && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4 animate-fade-in text-slate-100">
                    <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] max-w-2xl w-full p-10 shadow-2xl animate-scale-in relative overflow-hidden">
                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-pink-500/10 blur-[80px] rounded-full"></div>
                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/10 blur-[80px] rounded-full"></div>

                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-10">
                                <div>
                                    <h3 className="text-3xl font-black tracking-tight">
                                        {editingQuestion ? 'Editar Pregunta' : 'Nueva Pregunta'}
                                    </h3>
                                    <p className="text-slate-400 text-sm mt-1">Configura el enunciado y las opciones de respuesta.</p>
                                </div>
                                <button
                                    onClick={resetForm}
                                    className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/10"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                                        <span className="material-symbols-outlined text-sm">edit_note</span>
                                        Enunciado de la Pregunta
                                    </label>
                                    <textarea
                                        value={questionText}
                                        onChange={(e) => setQuestionText(e.target.value)}
                                        placeholder="Ej: ¿Cuál es el planeta más cercano al sol?"
                                        className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-5 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-all font-bold text-lg text-white placeholder:text-slate-600"
                                        rows={2}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {['A', 'B', 'C', 'D'].map((key, idx) => {
                                        const values = [optionA, optionB, optionC, optionD];
                                        const setters = [setOptionA, setOptionB, setOptionC, setOptionD];
                                        const isCorrect = correctOption === key;

                                        return (
                                            <div key={key} className="space-y-2">
                                                <label className="flex justify-between items-center px-1">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                        <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] ${isCorrect ? 'bg-green-500 text-white' : 'bg-slate-800'}`}>
                                                            {key}
                                                        </span>
                                                        Opción {key}
                                                    </span>
                                                    {isCorrect && (
                                                        <span className="text-[10px] font-black text-green-500 uppercase tracking-widest flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-xs">check_circle</span>
                                                            Correcta
                                                        </span>
                                                    )}
                                                </label>
                                                <div className="relative group">
                                                    <input
                                                        type="text"
                                                        value={values[idx]}
                                                        onChange={(e) => setters[idx](e.target.value)}
                                                        placeholder={`Respuesta ${key}...`}
                                                        className={`w-full bg-white/5 border rounded-2xl pl-5 pr-12 py-4 focus:outline-none transition-all font-bold text-sm ${isCorrect
                                                            ? 'border-green-500/50 ring-1 ring-green-500/20 bg-green-500/5'
                                                            : 'border-white/10 focus:border-pink-500 group-hover:border-white/20'
                                                            }`}
                                                    />
                                                    <button
                                                        onClick={() => setCorrectOption(key as OptionKey)}
                                                        className={`absolute right-3 top-3 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isCorrect
                                                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                                                            : 'bg-white/5 text-slate-600 hover:text-slate-300'
                                                            }`}
                                                        title="Marcar como correcta"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">{isCorrect ? 'done' : 'check'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="pt-6 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-8 items-end">
                                    <div className="space-y-4">
                                        <div className="flex justify-between">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tiempo de Respuesta</label>
                                            <span className="text-sm font-black text-pink-500">{duration} seg</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="5"
                                            max="60"
                                            step="5"
                                            value={duration}
                                            onChange={(e) => setDuration(parseInt(e.target.value))}
                                            className="w-full accent-pink-500 bg-white/5 h-2 rounded-full appearance-none cursor-pointer"
                                        />
                                        <div className="flex justify-between px-1">
                                            <span className="text-[8px] text-slate-600 font-bold uppercase">Rápido (5s)</span>
                                            <span className="text-[8px] text-slate-600 font-bold uppercase">Lento (60s)</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <button
                                            onClick={resetForm}
                                            className="flex-1 bg-white/5 hover:bg-white/10 py-5 rounded-2xl font-bold text-sm transition-all text-slate-400 hover:text-white border border-white/10"
                                        >
                                            CANCELAR
                                        </button>
                                        <button
                                            onClick={handleSaveQuestion}
                                            disabled={!questionText.trim() || !optionA.trim() || !optionB.trim()}
                                            className="flex-[1.5] bg-pink-600 hover:bg-pink-500 disabled:opacity-30 disabled:grayscale py-5 rounded-2xl font-black text-sm text-white shadow-xl shadow-pink-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-sm">{editingQuestion ? 'save' : 'add_circle'}</span>
                                            {editingQuestion ? 'ACTUALIZAR' : 'CREAR PREGUNTA'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TriviaAdmin;
