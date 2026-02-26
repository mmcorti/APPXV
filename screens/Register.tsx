
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../services/apiService';
import { StaffPermissions } from '../types';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

interface RegisterProps {
  onAuthSuccess: (id: string, name: string, email: string, role?: string, permissions?: StaffPermissions, eventId?: string, plan?: string) => void;
}

const RegisterScreen: React.FC<RegisterProps> = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Dynamically load reCAPTCHA v3 script if key is available
  useEffect(() => {
    if (RECAPTCHA_SITE_KEY && !(window as any).grecaptcha) {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // Username validation
  const usernameRegex = /^[a-zA-Z0-9._]{3,30}$/;
  const isUsernameValid = usernameRegex.test(username);
  const isPasswordValid = password.length >= 8;
  const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isRecoveryEmailValid = emailRegex.test(recoveryEmail);

  const getRecaptchaToken = async (): Promise<string> => {
    if (!RECAPTCHA_SITE_KEY || !(window as any).grecaptcha) return '';
    return new Promise((resolve) => {
      (window as any).grecaptcha.ready(() => {
        (window as any).grecaptcha
          .execute(RECAPTCHA_SITE_KEY, { action: 'register' })
          .then((token: string) => resolve(token))
          .catch(() => resolve(''));
      });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validations
    if (!isUsernameValid) {
      setError('El usuario debe tener entre 3 y 30 caracteres (letras, números, puntos y guiones bajos)');
      return;
    }
    if (!isRecoveryEmailValid) {
      setError('Por favor ingresa un email de recuperación válido');
      return;
    }
    if (!isPasswordValid) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!doPasswordsMatch) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      const captchaToken = await getRecaptchaToken();

      const user = await apiService.register({
        username: username.toLowerCase(),
        name,
        email: recoveryEmail,
        password,
        captchaToken
      });

      setSuccess(true);

      // Auto-login after registration
      setTimeout(() => {
        onAuthSuccess(user.id, user.name, user.email, user.role, user.permissions, user.eventId, user.plan);
        navigate('/dashboard');
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-[440px] z-10"
      >
        {/* Header/Banner */}
        <div className="relative mb-2 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-0 flex justify-center pt-0"
          >
            <img
              src="/logo.png"
              alt="APPXV"
              className="h-36 object-contain drop-shadow-[0_0_25px_rgba(16,185,129,0.5)]"
            />
          </motion.div>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-lg text-emerald-400">person_add</span>
            <p className="text-slate-400 font-medium italic text-lg">Crea tu cuenta y comienza a planificar</p>
          </div>
        </div>

        {/* Success State */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-[32px] shadow-2xl text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              >
                <span className="material-symbols-outlined text-6xl text-emerald-400">check_circle</span>
              </motion.div>
              <h3 className="text-white text-xl font-bold mt-4">¡Cuenta creada con éxito!</h3>
              <p className="text-slate-400 text-sm mt-2">Tu usuario es <span className="text-emerald-400 font-bold">{username.toLowerCase()}@appxv.app</span></p>
              <p className="text-slate-500 text-xs mt-3">Redirigiendo al dashboard...</p>
              <div className="mt-4 flex justify-center">
                <div className="w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Registration Card */}
        {!success && (
          <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-6 rounded-[32px] shadow-2xl">
            <div className="mb-5">
              <h2 className="text-slate-100 text-2xl font-bold tracking-tight">Crear Cuenta</h2>
              <p className="text-slate-400 text-sm mt-0">Elige un nombre de usuario único para tu cuenta</p>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-5 flex items-center gap-3 text-red-400 text-sm"
                >
                  <span className="material-symbols-outlined text-xl">error</span>
                  <p>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Username Field */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-2"
              >
                <label className="text-slate-300 text-sm font-semibold ml-1">Nombre de usuario</label>
                <div className="relative group">
                  <input
                    className="w-full bg-slate-800/50 border border-white/5 rounded-2xl p-4 pl-12 pr-[140px] text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all group-hover:bg-slate-800/80"
                    placeholder="tu.usuario"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                    required
                    maxLength={30}
                  />
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors">alternate_email</span>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400/80 font-bold text-sm bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">@appxv.app</span>
                </div>
                {username && !isUsernameValid && (
                  <p className="text-amber-400 text-xs ml-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">info</span>
                    Mín. 3 caracteres (letras, números, puntos, guiones bajos)
                  </p>
                )}
                {isUsernameValid && (
                  <p className="text-emerald-400 text-xs ml-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {username}@appxv.app
                  </p>
                )}
              </motion.div>

              {/* Full Name */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-2"
              >
                <label className="text-slate-300 text-sm font-semibold ml-1">Nombre completo</label>
                <div className="relative group">
                  <input
                    className="w-full bg-slate-800/50 border border-white/5 rounded-2xl p-4 pl-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all group-hover:bg-slate-800/80"
                    placeholder="Juan Pérez"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors">person</span>
                </div>
              </motion.div>

              {/* Recovery Email */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-2"
              >
                <label className="text-slate-300 text-sm font-semibold ml-1">Email de recuperación</label>
                <div className="relative group">
                  <input
                    className="w-full bg-slate-800/50 border border-white/5 rounded-2xl p-4 pl-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all group-hover:bg-slate-800/80"
                    placeholder="tu@email.com"
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    required
                  />
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors">mail</span>
                </div>
                {recoveryEmail && !isRecoveryEmailValid && (
                  <p className="text-amber-400 text-xs ml-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">info</span>
                    Email inválido
                  </p>
                )}
              </motion.div>

              {/* Password */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-2"
              >
                <label className="text-slate-300 text-sm font-semibold ml-1">Contraseña</label>
                <div className="relative group">
                  <input
                    className="w-full bg-slate-800/50 border border-white/5 rounded-2xl p-4 pl-12 pr-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all group-hover:bg-slate-800/80"
                    placeholder="Mínimo 8 caracteres"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors">lock</span>
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                {password && !isPasswordValid && (
                  <p className="text-amber-400 text-xs ml-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">info</span>
                    Mínimo 8 caracteres
                  </p>
                )}
              </motion.div>

              {/* Confirm Password */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-2"
              >
                <label className="text-slate-300 text-sm font-semibold ml-1">Confirmar contraseña</label>
                <div className="relative group">
                  <input
                    className="w-full bg-slate-800/50 border border-white/5 rounded-2xl p-4 pl-12 pr-12 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all group-hover:bg-slate-800/80"
                    placeholder="Repite tu contraseña"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors">lock_reset</span>
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    <span className="material-symbols-outlined text-xl">{showConfirm ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                {confirmPassword && !doPasswordsMatch && (
                  <p className="text-red-400 text-xs ml-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    Las contraseñas no coinciden
                  </p>
                )}
                {doPasswordsMatch && (
                  <p className="text-emerald-400 text-xs ml-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Las contraseñas coinciden
                  </p>
                )}
              </motion.div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.01, translateY: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading || !isUsernameValid || !isPasswordValid || !doPasswordsMatch || !isRecoveryEmailValid}
                className="w-full h-14 mt-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/40 disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Crear Cuenta</span>
                    <span className="material-symbols-outlined text-xl">how_to_reg</span>
                  </>
                )}
              </motion.button>
            </form>

            {/* Terms note */}
            <p className="text-slate-600 text-[11px] text-center mt-4 leading-relaxed">
              Al registrarte, aceptas nuestros términos de servicio y política de privacidad.
            </p>
          </div>
        )}

        <p className="text-center mt-6 text-slate-500 text-sm">
          ¿Ya tienes una cuenta? <button onClick={() => navigate('/login')} className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors">Inicia sesión</button>
        </p>
      </motion.div>
    </div>
  );
};

export default RegisterScreen;
