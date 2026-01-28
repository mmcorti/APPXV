import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { notionService } from '../services/notion';
import { StaffPermissions } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000/api';

interface LoginProps {
  onLogin: (id: string, name: string, email: string, role?: string, permissions?: StaffPermissions, eventId?: string, plan?: string) => void;
}

const LoginScreen: React.FC<LoginProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await notionService.login(email, password);
      onLogin(user.id, user.name, user.email, user.role, user.permissions, user.eventId, user.plan);
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError('Credenciales inválidas o error de conexión. Verifica los datos e intenta nuevamente.');
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
        <div className="relative mb-12 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-8 h-48 flex items-center justify-center"
          >
            <img
              src="/logo.png"
              alt="APPXV"
              className="h-48 object-contain drop-shadow-[0_0_25px_rgba(79,70,229,0.5)]"
            />
          </motion.div>
          <div className="flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-lg text-indigo-400">event_available</span>
            <p className="text-slate-400 font-medium italic text-lg">Gestiona tus eventos con estilo premium</p>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 rounded-[32px] shadow-2xl">
          <div className="mb-8">
            <h2 className="text-slate-100 text-2xl font-bold tracking-tight">Bienvenido</h2>
            <p className="text-slate-400 text-sm mt-1">Ingresa tus credenciales para continuar</p>
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
          </AnimatePresence>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-semibold ml-1">Correo electrónico</label>
              <div className="relative group">
                <input
                  className="w-full bg-slate-800/50 border border-white/5 rounded-2xl p-4 pl-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all group-hover:bg-slate-800/80"
                  placeholder="ejemplo@correo.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">mail</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-slate-300 text-sm font-semibold">Contraseña</label>
                <button type="button" className="text-indigo-400 text-xs font-bold hover:text-indigo-300 transition-colors">¿Olvidaste tu clave?</button>
              </div>
              <div className="relative group">
                <input
                  className="w-full bg-slate-800/50 border border-white/5 rounded-2xl p-4 pl-12 pr-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all group-hover:bg-slate-800/80"
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">lock</span>
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01, translateY: -2 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full h-14 mt-4 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 disabled:opacity-70 disabled:grayscale transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Ingresar</span>
                  <span className="material-symbols-outlined text-xl">login</span>
                </>
              )}
            </motion.button>
          </form>

          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-white/5"></div>
            <span className="text-slate-600 text-xs font-bold uppercase tracking-widest">O accede con</span>
            <div className="flex-1 h-px bg-white/5"></div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.05)" }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => window.location.href = `${API_URL}/auth/google?state=${encodeURIComponent(window.location.origin)}`}
            className="w-full h-14 border border-white/10 rounded-2xl flex items-center justify-center gap-3 text-slate-200 font-bold transition-all"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Google</span>
          </motion.button>
        </div>

        <p className="text-center mt-8 text-slate-500 text-sm">
          ¿No tienes cuenta? <button onClick={() => navigate('/register')} className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors">Regístrate ahora</button>
        </p>
      </motion.div>
    </div>
  );
};

export default LoginScreen;

