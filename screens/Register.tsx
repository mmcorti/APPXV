
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface RegisterProps {
  onRegister: (name: string, email: string) => void;
}

const RegisterScreen: React.FC<RegisterProps> = ({ onRegister }) => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRegister(name, email);
    navigate('/dashboard');
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-[480px] mx-auto bg-surface-light dark:bg-background-dark shadow-sm">
      <header className="flex items-center justify-between p-4 sticky top-0 z-10 bg-surface-light/90 dark:bg-background-dark/90 backdrop-blur-md">
        <button onClick={() => navigate('/')} className="flex size-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
          <span className="material-symbols-outlined text-text-main dark:text-text-light group-hover:text-primary transition-colors">arrow_back_ios_new</span>
        </button>
        <span className="font-bold text-lg">Registro</span>
        <div className="w-10"></div>
      </header>
      <main className="flex-1 px-6 pt-2 pb-8 flex flex-col">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-text-main dark:text-text-light mb-2">Crea tu cuenta</h1>
          <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed">Planifica bodas, eventos corporativos y fiestas en cuestión de minutos.</p>
        </div>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-text-main dark:text-gray-300">Nombre completo</label>
            <input 
              className="w-full h-14 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-4 text-base focus:border-primary focus:ring-primary transition-all outline-none" 
              placeholder="Juan Pérez" 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required 
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-text-main dark:text-gray-300">Correo electrónico</label>
            <input 
              className="w-full h-14 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-4 text-base focus:border-primary focus:ring-primary transition-all outline-none" 
              placeholder="nombre@ejemplo.com" 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-text-main dark:text-gray-300">Contraseña</label>
            <div className="relative">
              <input className="w-full h-14 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-4 pr-12 text-base focus:border-primary focus:ring-primary transition-all outline-none" placeholder="Mínimo 8 caracteres" type="password" required />
            </div>
          </div>
          <div className="pt-4">
            <button className="w-full h-14 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
              Registrarse
            </button>
          </div>
        </form>
      </main>
      <footer className="p-6 border-t border-border-light dark:border-gray-800">
        <div className="text-center text-sm text-gray-500">
          ¿Ya tienes una cuenta? 
          <Link to="/login" className="font-bold text-primary hover:text-primary-dark ml-1">Inicia sesión</Link>
        </div>
      </footer>
    </div>
  );
};

export default RegisterScreen;
