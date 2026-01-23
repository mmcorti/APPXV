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

    useEffect(() => {
        if (!eventId) return;
        const unsubscribe = triviaService.subscribe(eventId, setGameState);
        return unsubscribe;
    }, [eventId]);

    if (!eventId || !gameState) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-white">Cargando...</div>
            </div>
        );
    }

    const currentQuestion = gameState.currentQuestionIndex >= 0
        ? gameState.questions[gameState.currentQuestionIndex]
        : null;
    const totalPlayers = Object.keys(gameState.players).length;

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

    const qrUrl = `${window.location.origin}/#/trivia/${eventId}/play`;

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <header className="bg-slate-900/80 border-b border-slate-800 px-6 py-4 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-slate-800 rounded-lg"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold">Trivia Admin</h1>
                            <div className="flex items-center gap-2 text-sm">
                                <span
                                    className={`px-2 py-0.5 rounded text-xs font-bold ${gameState.status === 'PLAYING' ? 'bg-green-600' :
                                        gameState.status === 'FINISHED' ? 'bg-amber-600' : 'bg-slate-600'
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
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-medium"
                        >
                            <span className="material-symbols-outlined text-sm">tv</span>
                            Pantalla Gigante
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Controls */}
                <div className="space-y-4">
                    {/* Game Controls */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                        <h2 className="text-lg font-bold mb-4">Control del Juego</h2>

                        <div className="space-y-3">
                            {gameState.status === 'WAITING' && (
                                <button
                                    onClick={handleStartGame}
                                    disabled={gameState.questions.length === 0}
                                    className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-bold transition-all"
                                >
                                    INICIAR JUEGO
                                </button>
                            )}

                            {gameState.status === 'PLAYING' && (
                                <>
                                    {currentQuestion && (
                                        <div className="bg-slate-800 rounded-lg p-3 mb-3">
                                            <p className="text-xs text-slate-400 uppercase">Pregunta Actual</p>
                                            <p className="font-medium truncate">{currentQuestion.text}</p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {gameState.currentQuestionIndex + 1} de {gameState.questions.length}
                                            </p>
                                        </div>
                                    )}

                                    {gameState.currentQuestionIndex === -1 ? (
                                        <button
                                            onClick={handleNextQuestion}
                                            className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-lg font-bold"
                                        >
                                            Lanzar Primera Pregunta
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={handleRevealAnswer}
                                                disabled={gameState.isAnswerRevealed}
                                                className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-bold"
                                            >
                                                {gameState.isAnswerRevealed ? 'Respuesta Revelada' : 'Revelar Respuesta'}
                                            </button>
                                            <button
                                                onClick={handleNextQuestion}
                                                className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-lg font-bold"
                                            >
                                                Siguiente Pregunta →
                                            </button>
                                        </>
                                    )}

                                    <button
                                        onClick={handleEndGame}
                                        className="w-full bg-red-600 hover:bg-red-500 py-2 rounded-lg font-medium mt-4"
                                    >
                                        Finalizar Juego
                                    </button>
                                </>
                            )}

                            {gameState.status === 'FINISHED' && (
                                <button
                                    onClick={handleResetGame}
                                    className="w-full bg-red-600 hover:bg-red-500 py-3 rounded-lg font-bold"
                                >
                                    Reiniciar Todo
                                </button>
                            )}
                        </div>
                    </div>

                    {/* QR Code */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 text-center">
                        <h2 className="text-lg font-bold mb-3">Enlace para Jugadores</h2>
                        <div className="bg-white p-3 rounded-lg inline-block">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}`}
                                alt="QR Code"
                                className="w-32 h-32"
                            />
                        </div>
                        <p className="text-xs text-slate-400 mt-2 break-all">{qrUrl}</p>
                    </div>
                </div>

                {/* Right Column: Questions */}
                <div className="lg:col-span-2">
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold">Preguntas ({gameState.questions.length})</h2>
                            <button
                                onClick={() => setShowQuestionForm(true)}
                                className="flex items-center gap-2 bg-pink-600 hover:bg-pink-500 px-4 py-2 rounded-lg font-medium"
                            >
                                <span className="material-symbols-outlined text-sm">add</span>
                                Nueva Pregunta
                            </button>
                        </div>

                        {/* Question Form Modal */}
                        {showQuestionForm && (
                            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                                <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
                                    <h3 className="text-xl font-bold mb-4">
                                        {editingQuestion ? 'Editar Pregunta' : 'Nueva Pregunta'}
                                    </h3>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-1">Pregunta</label>
                                            <textarea
                                                value={questionText}
                                                onChange={(e) => setQuestionText(e.target.value)}
                                                placeholder="Ej: ¿Quién es el jugador número 10 de la Selección?"
                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-pink-500"
                                                rows={2}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            {['A', 'B', 'C', 'D'].map((key, idx) => (
                                                <div key={key}>
                                                    <label className="block text-sm text-slate-400 mb-1">Opción {key}</label>
                                                    <input
                                                        type="text"
                                                        value={[optionA, optionB, optionC, optionD][idx]}
                                                        onChange={(e) => {
                                                            const setters = [setOptionA, setOptionB, setOptionC, setOptionD];
                                                            setters[idx](e.target.value);
                                                        }}
                                                        placeholder={`Respuesta ${key}`}
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-pink-500"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-1">Respuesta Correcta</label>
                                                <select
                                                    value={correctOption}
                                                    onChange={(e) => setCorrectOption(e.target.value as OptionKey)}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
                                                >
                                                    <option value="A">A</option>
                                                    <option value="B">B</option>
                                                    <option value="C">C</option>
                                                    <option value="D">D</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-1">Tiempo (seg)</label>
                                                <input
                                                    type="number"
                                                    value={duration}
                                                    onChange={(e) => setDuration(parseInt(e.target.value) || 10)}
                                                    min={5}
                                                    max={60}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mt-6">
                                        <button
                                            onClick={resetForm}
                                            className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-medium"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleSaveQuestion}
                                            className="flex-1 bg-pink-600 hover:bg-pink-500 py-3 rounded-lg font-bold"
                                        >
                                            Guardar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Questions List */}
                        <div className="space-y-3 max-h-[500px] overflow-y-auto">
                            {gameState.questions.map((q, idx) => (
                                <div
                                    key={q.id}
                                    className={`p-4 rounded-lg border transition-all ${gameState.currentQuestionIndex === idx
                                        ? 'border-green-500 bg-green-500/10'
                                        : 'border-slate-700 bg-slate-800'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <span className="text-slate-500 font-mono mr-2">#{idx + 1}</span>
                                            <span className="font-medium">{q.text}</span>
                                        </div>
                                        <div className="flex items-center gap-2 ml-3">
                                            <span className="text-xs text-slate-500">{q.durationSeconds}s</span>
                                            <button
                                                onClick={() => handleEditQuestion(q)}
                                                className="p-1.5 hover:bg-slate-700 rounded"
                                            >
                                                <span className="material-symbols-outlined text-sm">edit</span>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteQuestion(q.id)}
                                                className="p-1.5 hover:bg-red-500/20 rounded text-red-400"
                                            >
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-400">
                                        {q.options.map((opt) => (
                                            <span
                                                key={opt.key}
                                                className={opt.key === q.correctOption ? 'text-green-400 font-medium' : ''}
                                            >
                                                {opt.key}: {opt.text}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {gameState.questions.length === 0 && (
                                <div className="text-center text-slate-500 py-12">
                                    <span className="material-symbols-outlined text-4xl mb-2 block opacity-50">quiz</span>
                                    No hay preguntas. ¡Agrega algunas!
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TriviaAdmin;
