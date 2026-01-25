
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from '../types';
import { confessionsService, ConfessionsState } from '../services/confessionsService';

interface ConfessionsAdminProps {
    user: User | null;
}

const ConfessionsAdmin: React.FC<ConfessionsAdminProps> = ({ user }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [state, setState] = useState<ConfessionsState | null>(null);
    const [loading, setLoading] = useState(true);
    const [bgUrl, setBgUrl] = useState('');

    useEffect(() => {
        if (!id) return;
        loadState();

        // Subscribe to updates
        const unsubscribe = confessionsService.subscribe(id, (newState) => {
            setState(newState);
            setBgUrl(newState.backgroundUrl);
        });

        return () => unsubscribe();
    }, [id]);

    const loadState = async () => {
        if (!id) return;
        try {
            const data = await confessionsService.getState(id);
            setState(data);
            setBgUrl(data.backgroundUrl);
        } catch (e) {
            console.error('Failed to load state', e);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async () => {
        if (!state || !id) return;
        const newStatus = state.status === 'ACTIVE' ? 'STOPPED' : 'ACTIVE';
        await confessionsService.updateConfig(id, { status: newStatus });
    };

    const saveBackground = async () => {
        if (!state || !id) return;
        await confessionsService.updateConfig(id, { backgroundUrl: bgUrl });
        alert('Background updated!');
    };

    const resetGame = async () => {
        if (!id || !confirm('Are you sure you want to clear all messages?')) return;
        await confessionsService.resetGame(id);
    };

    if (loading) return <div className="p-8 text-white">Loading...</div>;
    if (!state) return <div className="p-8 text-white">Error loading game state</div>;

    const messageCount = state.messages.length;

    return (
        <div className="min-h-screen bg-slate-950 text-white font-display pb-20">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(`/games/${id}`)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold">Confessions Control</h1>
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${state.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                                <span className="text-xs font-mono uppercase text-slate-400">{state.status}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={resetGame}
                            className="p-2 bg-slate-800 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
                            title="Reset Game">
                            <span className="material-symbols-outlined">delete_sweep</span>
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-4xl mx-auto p-4 space-y-6">

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-400 text-sm font-medium">Messages</span>
                            <span className="material-symbols-outlined text-yellow-400">sticky_note_2</span>
                        </div>
                        <p className="text-3xl font-bold">{messageCount}</p>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-400 text-sm font-medium">Status</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={state.status === 'ACTIVE'} onChange={toggleStatus} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>
                        <p className="text-lg font-bold text-slate-300">{state.status === 'ACTIVE' ? 'Receiving' : 'Stopped'}</p>
                    </div>
                </div>

                {/* Main Actions */}
                <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl">
                    <button
                        onClick={() => window.open(`#/confessions/${id}/screen`, '_blank')}
                        className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-pink-900/20 active:scale-[0.98]">
                        <span className="material-symbols-outlined">rocket_launch</span>
                        LAUNCH BIG SCREEN
                    </button>
                    <div className="mt-4 flex justify-between items-center">
                        <div className="text-center w-full">
                            <p className="text-xs text-slate-500 mb-2">Guest Link (Share QR)</p>
                            <button
                                onClick={() => window.open(`#/confessions/${id}/guest`, '_blank')}
                                className="text-sm text-pink-400 hover:underline">
                                Open Guest View
                            </button>
                        </div>
                    </div>
                </div>

                {/* Configuration */}
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                    <h3 className="font-bold mb-4">Background Image</h3>
                    <div className="aspect-video bg-slate-950 rounded-xl overflow-hidden mb-4 relative group">
                        <img src={bgUrl} alt="Background" className="w-full h-full object-cover opacity-60" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="bg-black/50 text-white px-3 py-1 rounded-full text-xs backdrop-blur-sm">Preview</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={bgUrl}
                            onChange={(e) => setBgUrl(e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
                            placeholder="https://... or Paste Google Photos Link"
                        />
                        <button
                            onClick={saveBackground}
                            className="px-6 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-sm transition-colors">
                            Save
                        </button>
                    </div>

                    {/* File Upload / Image Picker */}
                    <div className="mt-4 pt-4 border-t border-slate-800">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="bg-slate-800 p-2 rounded-lg group-hover:bg-slate-700 transition-colors">
                                <span className="material-symbols-outlined text-pink-400">upload_file</span>
                            </div>
                            <div>
                                <span className="text-sm font-medium block">Upload from computer</span>
                                <span className="text-xs text-slate-500">Supports JPG, PNG</span>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    // Simple loading state could be added here
                                    const savedText = "Uploading...";
                                    const prevUrl = bgUrl;
                                    setBgUrl(savedText);

                                    try {
                                        const reader = new FileReader();
                                        reader.readAsDataURL(file);
                                        reader.onload = async () => {
                                            const base64 = reader.result;
                                            const res = await fetch('/api/upload-image', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ image: base64 })
                                            });
                                            const data = await res.json();
                                            if (data.success) {
                                                setBgUrl(data.url);
                                            } else {
                                                alert('Upload failed: ' + data.error);
                                                setBgUrl(prevUrl);
                                            }
                                        };
                                    } catch (err) {
                                        console.error(err);
                                        alert('Error uploading file');
                                        setBgUrl(prevUrl);
                                    }
                                }}
                            />
                        </label>
                    </div>
                </div>

                {/* Recent Messages Preview */}
                <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                    <h3 className="font-bold mb-4">Recent Confessions</h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {state.messages.slice().reverse().map((msg) => (
                            <div key={msg.id} className="bg-slate-800 p-3 rounded-xl border border-slate-700/50 flex gap-3">
                                <div className="w-2 self-stretch rounded-full" style={{ backgroundColor: msg.color }}></div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-200">"{msg.text}"</p>
                                    <p className="text-xs text-slate-500 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        ))}
                        {state.messages.length === 0 && (
                            <p className="text-slate-500 text-center py-8">No messages yet. Start the party!</p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ConfessionsAdmin;
