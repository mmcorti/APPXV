
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { confessionsService } from '../services/confessionsService';

const ConfessionsGuest: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [text, setText] = useState('');
    const [author, setAuthor] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!text.trim() || !id) return;
        setLoading(true);
        setError('');

        try {
            await confessionsService.sendMessage(id, text, author || 'Anonymous');
            setSubmitted(true);
            setText('');
            setAuthor('');
        } catch (e: any) {
            setError(e.message || 'Error sending message');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-[#101622] text-white flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
                <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-green-500/20">
                    <span className="material-symbols-outlined text-5xl">check</span>
                </div>
                <h2 className="text-3xl font-bold mb-2">Sent!</h2>
                <p className="text-slate-400 text-center mb-8">Your confession is now live on the big screen.</p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button
                        onClick={() => setSubmitted(false)}
                        className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-slate-200 transition-colors">
                        Send Another
                    </button>
                    <button
                        onClick={() => window.close()}
                        className="w-full bg-white/5 text-white font-medium py-4 rounded-xl hover:bg-white/10 transition-colors">
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#101622] text-white font-display">
            {/* Header */}
            <div className="p-6 flex items-center justify-between border-b border-white/5">
                <span className="material-symbols-outlined text-pink-500">favorite</span>
                <h1 className="font-bold text-lg">Confessions</h1>
                <div className="w-6"></div>
            </div>

            <main className="p-6 max-w-md mx-auto flex flex-col gap-6">
                <div>
                    <h2 className="text-3xl font-bold mb-2">Share a secret</h2>
                    <p className="text-slate-400">Whatever you type will appear on the big screen anonymously. Make it fun!</p>
                </div>

                <div className="space-y-4">
                    <div className="relative">
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value.slice(0, 140))}
                            placeholder="I once..."
                            className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-6 h-48 text-lg focus:border-pink-500 focus:outline-none transition-colors resize-none placeholder:text-slate-600"
                        />
                        <div className="absolute bottom-4 right-4 text-xs font-bold bg-black/20 px-2 py-1 rounded text-slate-400">
                            {text.length}/140
                        </div>
                    </div>

                    <div>
                        <input
                            value={author}
                            onChange={(e) => setAuthor(e.target.value.slice(0, 20))}
                            placeholder="Alias (Optional)"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-pink-500 focus:outline-none transition-colors"
                        />
                    </div>

                    {error && <p className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded">{error}</p>}

                    <button
                        onClick={handleSubmit}
                        disabled={loading || !text.trim()}
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all
                            ${!text.trim() ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-pink-600 hover:bg-pink-500 text-white shadow-pink-900/20 active:scale-[0.98]'}
                        `}
                    >
                        {loading ? 'Sending...' : (
                            <>
                                <span className="material-symbols-outlined">send</span>
                                Send Confession
                            </>
                        )}
                    </button>

                    <p className="text-center text-xs text-slate-600 uppercase tracking-widest mt-4">
                        Live Event Mode
                    </p>
                </div>
            </main>
        </div>
    );
};

export default ConfessionsGuest;
