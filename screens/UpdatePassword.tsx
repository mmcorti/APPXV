import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../services/apiService';

const UpdatePasswordScreen: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [accessToken, setAccessToken] = useState('');

    useEffect(() => {
        // Supabase appends the access_token in the URL hash like #access_token=xyz&type=recovery
        const hash = window.location.hash;
        const tokenMatch = hash.match(/access_token=([^&]+)/);

        if (tokenMatch && tokenMatch[1]) {
            setAccessToken(tokenMatch[1]);
        } else {
            setError('Enlace inválido o expirado. Por favor, solicita uno nuevo.');
        }
    }, [location]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!accessToken) {
            setError('No hay token de acceso válido.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await apiService.updatePassword(accessToken, password);
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error al actualizar la contraseña.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full"></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="w-full max-w-[440px] z-10"
            >
                {/* Header/Banner */}
                <div className="relative mb-8 text-center">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.8 }}
                        className="mb-0 flex justify-center pt-0"
                    >
                        <img
                            src="/logo.png"
                            alt="APPXV"
                            className="h-40 object-contain drop-shadow-[0_0_25px_rgba(79,70,229,0.5)]"
                        />
                    </motion.div>
                </div>

                {/* Main Card */}
                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-6 rounded-[32px] shadow-2xl">
                    <div className="mb-6">
                        <h2 className="text-slate-100 text-2xl font-bold tracking-tight">Crea una nueva clave</h2>
                        <p className="text-slate-400 text-sm mt-1">Escribe tu nueva contraseña de acceso</p>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-6 flex items-center gap-3 text-red-400 text-sm"
                            >
                                <span className="material-symbols-outlined text-xl">error</span>
                                <p>{error}</p>
                            </motion.div>
                        )}
                        {success && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl mb-6 flex items-center gap-3 text-green-400 text-sm"
                            >
                                <span className="material-symbols-outlined text-xl">check_circle</span>
                                <p>Contraseña actualizada con éxito. Redirigiendo al login...</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {!success && (
                        <form className="space-y-5" onSubmit={handleSubmit}>
                            <div className="space-y-2">
                                <label className="text-slate-300 text-sm font-semibold ml-1">Nueva Contraseña</label>
                                <div className="relative group">
                                    <input
                                        className="w-full bg-slate-800/50 border border-white/5 rounded-2xl p-4 pl-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        placeholder="••••••••"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={!accessToken}
                                    />
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">lock</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-slate-300 text-sm font-semibold ml-1">Confirmar Contraseña</label>
                                <div className="relative group">
                                    <input
                                        className="w-full bg-slate-800/50 border border-white/5 rounded-2xl p-4 pl-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        placeholder="••••••••"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        disabled={!accessToken}
                                    />
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">lock</span>
                                </div>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.01, translateY: -2 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={loading || !accessToken}
                                className="w-full h-14 mt-4 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 disabled:opacity-70 disabled:grayscale transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <span>Guardar Contraseña</span>
                                        <span className="material-symbols-outlined text-xl">save</span>
                                    </>
                                )}
                            </motion.button>
                        </form>
                    )}

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => navigate('/login')}
                            className="text-slate-500 hover:text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1 w-full"
                        >
                            <span className="material-symbols-outlined text-sm">arrow_back</span>
                            Volver al Login
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default UpdatePasswordScreen;
