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
import { apiService } from '../services/apiService';

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



    const currentQuestion = (gameState?.questions && gameState.currentQuestionIndex >= 0)
        ? gameState.questions[gameState.currentQuestionIndex]
        : null;
    const totalPlayers = gameState?.players
        ? Object.values(gameState.players).filter((p: any) => p.online !== false).length
        : 0;

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
                const url = await apiService.uploadImage(base64);
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

    if (!eventId || !gameState || !gameState.questions || !gameState.players) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
            {/* Header */}
            <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-50">
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
                                <span className="material-symbols-outlined text-pink-400">quiz</span>
                                Trivia - Admin
                            </h1>
                            <div className="flex items-center gap-2 text-sm">
                                <span
                                    className={`px-2 py-0.5 rounded text-xs font-bold ${gameState.status === 'PLAYING' ? 'bg-green-500' :
                                        gameState.status === 'FINISHED' ? 'bg-purple-500' : 'bg-gray-600'
                                        }`}
                                >
                                    {gameState.status === 'WAITING' ? 'EN ESPERA' :
                                        gameState.status === 'PLAYING' ? 'EN VIVO' : 'FINALIZADO'}
                                </span>
                                <span className="text-pink-400">{totalPlayers} jugadores</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.open(`#/trivia/${eventId}/screen`, '_blank')}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">tv</span>
                            Pantalla Gigante
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6">
                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('LIVE')}
                        className={`pb-2 px-4 font-semibold ${activeTab === 'LIVE' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
                    >
                        Juego en Vivo
                    </button>
                    <button
                        onClick={() => setActiveTab('CONFIG')}
                        className={`pb-2 px-4 font-semibold ${activeTab === 'CONFIG' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
                    >
                        Configuración
                    </button>
                </div>

                {activeTab === 'LIVE' ? (
                    <div className="space-y-6 animate-fade-in">
                        {/* Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
                                <div className="text-2xl font-bold">{totalPlayers}</div>
                                <div className="text-gray-500 text-sm">Jugadores</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-indigo-500">
                                <div className="text-2xl font-bold">
                                    {Math.max(0, gameState.currentQuestionIndex + 1)} <span className="text-gray-400 text-lg font-normal">/ {gameState.questions.length}</span>
                                </div>
                                <div className="text-gray-500 text-sm">Pregunta Actual</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500">
                                <div className="text-2xl font-bold">
                                    {gameState.status === 'WAITING' ? 'En Espera' : gameState.status === 'PLAYING' ? 'En Vivo' : 'Finalizado'}
                                </div>
                                <div className="text-gray-500 text-sm">Estado</div>
                            </div>
                        </div>

                        {/* Game Controls */}
                        <div className="flex flex-wrap gap-3">
                            {gameState.status === 'WAITING' && (
                                <button
                                    onClick={handleStartGame}
                                    disabled={gameState.questions.length === 0}
                                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined">play_arrow</span>
                                    Iniciar Juego
                                </button>
                            )}

                            {gameState.status === 'PLAYING' && (
                                <>
                                    {gameState.currentQuestionIndex === -1 ? (
                                        <button
                                            onClick={handleNextQuestion}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                                        >
                                            <span className="material-symbols-outlined">rocket_launch</span>
                                            Lanzar Primera Pregunta
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={handleRevealAnswer}
                                                disabled={gameState.isAnswerRevealed}
                                                className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                                            >
                                                <span className="material-symbols-outlined">{gameState.isAnswerRevealed ? 'done_all' : 'visibility'}</span>
                                                {gameState.isAnswerRevealed ? 'Respuesta Revelada' : 'Revelar Respuesta'}
                                            </button>
                                            <button
                                                onClick={handleNextQuestion}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                                            >
                                                <span className="material-symbols-outlined">skip_next</span>
                                                Siguiente Pregunta
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => setIsAutoEnabled(!isAutoEnabled)}
                                        className={`px-5 py-2 rounded-lg font-bold flex items-center gap-2 border ${isAutoEnabled
                                            ? 'bg-pink-50 border-pink-400 text-pink-700'
                                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        <span className="material-symbols-outlined">{isAutoEnabled ? 'pause_circle' : 'autoplay'}</span>
                                        {isAutoEnabled ? 'Auto Activo' : 'Modo Automático'}
                                    </button>
                                    <button
                                        onClick={handleEndGame}
                                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">flag</span>
                                        Finalizar Juego
                                    </button>
                                </>
                            )}

                            <button
                                onClick={handleResetGame}
                                className="bg-red-100 text-red-700 hover:bg-red-200 px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">restart_alt</span>
                                Reiniciar Juego
                            </button>
                        </div>

                        {/* Finished Banner */}
                        {gameState.status === 'FINISHED' && (
                            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-8 rounded-2xl text-center">
                                <h2 className="text-3xl font-bold mb-2">🎉 ¡Trivia Completada!</h2>
                                <p className="text-white/90">Revisa el podio final en la Pantalla Gigante o reinicia para una nueva partida.</p>
                            </div>
                        )}

                        {/* Current Question Preview */}
                        <section>
                            <h2 className="text-xl font-bold mb-4">Pregunta en Pantalla</h2>
                            {currentQuestion ? (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                                    <h3 className="text-lg font-bold text-gray-900">{currentQuestion.text}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {currentQuestion.options.map((opt) => (
                                            <div
                                                key={opt.key}
                                                className={`p-3 rounded-lg border text-sm flex items-center gap-3 ${opt.key === currentQuestion.correctOption
                                                    ? 'bg-green-50 border-green-400 text-green-800 font-semibold'
                                                    : 'bg-gray-50 border-gray-200 text-gray-700'
                                                    }`}
                                            >
                                                <span className="font-bold opacity-60">{opt.key}</span>
                                                <span className="truncate">{opt.text}</span>
                                                {opt.key === currentQuestion.correctOption && (
                                                    <span className="material-symbols-outlined text-sm ml-auto">check_circle</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                                    <span className="material-symbols-outlined text-4xl mb-2">monitor</span>
                                    <p>No hay una pregunta activa en este momento.</p>
                                </div>
                            )}
                        </section>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                        {/* Left Column: Questions -> AI Generator -> Global Settings */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Questions List */}
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h2 className="text-lg font-bold flex items-center gap-2">
                                            <span className="material-symbols-outlined">quiz</span>
                                            Banco de Preguntas ({gameState.questions.length})
                                        </h2>
                                    </div>
                                    <button
                                        onClick={() => {
                                            resetForm();
                                            setShowQuestionForm(true);
                                        }}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium"
                                    >
                                        <span className="material-symbols-outlined text-sm">add</span>
                                        Agregar Manual
                                    </button>
                                </div>

                                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                                    {gameState.questions.map((q, idx) => (
                                        <div
                                            key={q.id}
                                            className={`p-4 rounded-xl border transition-all group ${gameState.currentQuestionIndex === idx
                                                ? 'border-indigo-500 bg-indigo-50/40'
                                                : 'border-gray-200 bg-gray-50/60 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-xs font-bold">#{idx + 1}</span>
                                                        <span className="text-xs font-medium text-gray-500">{q.durationSeconds}s</span>
                                                    </div>
                                                    <h4 className="font-semibold text-gray-900">{q.text}</h4>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleEditQuestion(q)}
                                                        className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-gray-900 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteQuestion(q.id)}
                                                        className="p-1.5 hover:bg-red-100 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-2">
                                                {q.options.map((opt) => (
                                                    <div
                                                        key={opt.key}
                                                        className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 ${opt.key === q.correctOption
                                                            ? 'bg-green-100 text-green-800 font-medium'
                                                            : 'bg-white border border-gray-200 text-gray-600'
                                                            }`}
                                                    >
                                                        <span className="font-bold opacity-60">{opt.key}</span>
                                                        <span className="truncate">{opt.text}</span>
                                                        {opt.key === q.correctOption && <span className="material-symbols-outlined text-xs ml-auto">check</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    {gameState.questions.length === 0 && (
                                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400">
                                            <span className="material-symbols-outlined text-4xl mb-2 block">quiz</span>
                                            <p>Aún no hay preguntas cargadas</p>
                                            <button
                                                onClick={() => setShowQuestionForm(true)}
                                                className="mt-3 text-indigo-600 font-semibold text-sm hover:underline"
                                            >
                                                Agregar mi primera pregunta
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* AI Generator */}
                            <section className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl shadow-sm border border-indigo-100">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-900">
                                    <span className="material-symbols-outlined">auto_awesome</span>
                                    Generar con IA
                                </h2>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={aiTheme}
                                        onChange={(e) => setAiTheme(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && aiTheme.trim() && handleGenerateAI()}
                                        placeholder="Ej: Historia del Rock, Películas, Cumpleaños de 15..."
                                        className="flex-1 border border-indigo-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                    />
                                    <select
                                        value={aiCount}
                                        onChange={(e) => setAiCount(parseInt(e.target.value))}
                                        className="border border-indigo-200 rounded-lg p-2 bg-white text-sm"
                                    >
                                        {[1, 3, 5, 10, 15].map(n => (
                                            <option key={n} value={n}>{n} {n === 1 ? 'pregunta' : 'preguntas'}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleGenerateAI}
                                        disabled={isGeneratingAI || !aiTheme.trim()}
                                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium shadow-md shadow-indigo-200"
                                    >
                                        {isGeneratingAI ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Generando...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-sm">magic_button</span>
                                                Generar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </section>

                            {/* Global Settings */}
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined">settings</span>
                                    Configuración Global
                                </h2>

                                {/* Global Time */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tiempo Global (segundos por pregunta)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={duration}
                                            onChange={(e) => setDuration(Math.max(5, parseInt(e.target.value) || 10))}
                                            className="w-28 border border-gray-300 rounded-lg p-2 text-center font-bold"
                                        />
                                        <button
                                            onClick={async () => {
                                                if (window.confirm(`¿Cambiar el tiempo a ${duration} segundos para TODAS las ${gameState.questions.length} preguntas?`)) {
                                                    await triviaService.updateAllDurations(eventId!, duration);
                                                    alert('¡Tiempos actualizados correctamente!');
                                                }
                                            }}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                                        >
                                            Aplicar a Todas
                                        </button>
                                    </div>
                                </div>

                                {/* Background Image */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Imagen del Evento (Personalizada)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={bgUrl}
                                            onChange={(e) => setBgUrl(e.target.value)}
                                            placeholder="URL de imagen..."
                                            className="flex-1 bg-gray-50 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                        <label className="bg-white border-2 border-indigo-600 text-indigo-600 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-center min-w-[50px]">
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                                            {uploading ? (
                                                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <span className="material-symbols-outlined">upload</span>
                                            )}
                                        </label>
                                        <button
                                            onClick={() => handleSaveBackground()}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                                        >
                                            Guardar
                                        </button>
                                    </div>
                                    {bgUrl && (
                                        <div className="mt-2 relative group w-full h-32">
                                            <img src={bgUrl} alt="Preview" className="h-full w-full object-cover rounded-xl border border-gray-200" />
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>

                        {/* Right Column: QR Code & Links */}
                        <div className="space-y-6">
                            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                                <h2 className="text-lg font-bold mb-3 flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined">qr_code_2</span>
                                    Enlace para Jugadores
                                </h2>
                                <div className="bg-gray-50 p-4 rounded-lg inline-block">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}`}
                                        alt="QR Access"
                                        className="w-44 h-44 mx-auto"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-3 break-all px-2">{qrUrl}</p>
                                <button
                                    onClick={() => navigator.clipboard.writeText(qrUrl)}
                                    className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 mx-auto"
                                >
                                    <span className="material-symbols-outlined text-sm">content_copy</span>
                                    Copiar enlace
                                </button>
                                <button
                                    onClick={() => window.open(qrUrl, '_blank')}
                                    className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors"
                                >
                                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                                    Probar como Invitado
                                </button>
                            </section>
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
