
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { notionService } from '../services/notion';

interface LoginProps {
  onLogin: (name: string, email: string) => void;
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
      // Intenta iniciar sesión contra el backend de Notion
      const user = await notionService.login(email, password);
      onLogin(user.name, user.email, user.role);
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError('Credenciales inválidas o error de conexión. Verifica que el servidor (npm run dev) esté corriendo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full max-w-[480px] mx-auto overflow-x-hidden min-h-screen justify-between bg-background-light dark:bg-background-dark">
      <div className="p-4">
        <div className="w-full bg-center bg-no-repeat bg-cover flex flex-col justify-end overflow-hidden bg-white dark:bg-gray-800 rounded-3xl min-h-[240px] relative shadow-lg" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=800")' }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
          <div className="relative z-10 p-6">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl mb-3 flex items-center justify-center text-white border border-white/30">
              <span className="material-symbols-outlined text-3xl">event_available</span>
            </div>
            <h1 className="text-white text-3xl font-bold tracking-tight">APPXV</h1>
            <p className="text-white/80 text-sm font-medium mt-1">Tu evento, perfectamente organizado</p>
          </div>
        </div>
      </div>

      <div className="px-6 pt-6">
        <h2 className="text-text-main dark:text-white tracking-tight text-2xl font-bold">Bienvenido de nuevo</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Inicia sesión para administrar tus eventos</p>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      <form className="flex flex-col gap-4 mt-6 px-6" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <p className="text-text-main dark:text-gray-200 text-sm font-medium">Correo electrónico</p>
          <div className="flex w-full items-stretch rounded-xl shadow-sm border border-border-light dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <input
              className="flex-1 bg-transparent border-0 focus:ring-0 p-4 text-text-main dark:text-white placeholder:text-gray-400"
              placeholder="tu@correo.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="flex items-center px-4 text-gray-400">
              <span className="material-symbols-outlined">mail</span>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <p className="text-text-main dark:text-gray-200 text-sm font-medium">Contraseña</p>
            <button type="button" className="text-primary text-xs font-semibold">¿Olvidaste tu contraseña?</button>
          </div>
          <div className="flex w-full items-stretch rounded-xl shadow-sm border border-border-light dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <input
              className="flex-1 bg-transparent border-0 focus:ring-0 p-4 text-text-main dark:text-white placeholder:text-gray-400"
              placeholder="••••••••"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="flex items-center px-4 text-gray-400 cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
              <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
            </div>
          </div>
        </div>

        <div className="flex pt-4 gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 h-14 cursor-pointer items-center justify-center rounded-xl bg-primary text-white text-base font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? 'Iniciando...' : 'Iniciar Sesión'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginScreen;
