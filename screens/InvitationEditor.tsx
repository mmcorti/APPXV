
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { InvitationData, ImageSize } from '../types';
import { GeminiService } from '../services/gemini';

interface InvitationEditorProps {
  invitations: InvitationData[];
  onSave: (data: InvitationData) => void;
}

const InvitationEditor: React.FC<InvitationEditorProps> = ({ invitations, onSave }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const invitation = invitations.find(inv => inv.id === id);
  const giftsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<InvitationData>(invitation || {
    id: id || '1',
    eventName: '',
    hostName: '',
    date: '',
    time: '',
    location: '',
    image: '',
    message: '',
    giftType: 'alias',
    giftDetail: '',
    guests: []
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedSize, setSelectedSize] = useState<ImageSize>(ImageSize.SIZE_1K);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    if (invitation) {
      setFormData(invitation);
    }
  }, [invitation]);

  useEffect(() => {
    if (location.hash === '#regalos' && giftsRef.current) {
      setTimeout(() => {
        giftsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, [location]);

  if (!invitation) return <div className="p-10 text-center font-bold">Invitación no encontrada</div>;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAiAction = async (type: 'generate' | 'edit') => {
    if (!aiPrompt) return;
    setAiLoading(true);
    setAiError('');

    try {
      const aiStudio = (window as any).aistudio;
      if (aiStudio) {
        const hasKey = await aiStudio.hasSelectedApiKey();
        if (!hasKey) {
          await aiStudio.openSelectKey();
        }
      }

      let resultUrl = '';
      if (type === 'generate') {
        resultUrl = await GeminiService.generateImage(aiPrompt, selectedSize);
      } else {
        resultUrl = await GeminiService.editImage(formData.image, aiPrompt);
      }

      setFormData(prev => ({ ...prev, image: resultUrl }));
      setShowAiModal(false);
      setAiPrompt('');
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      setAiError(`Error: ${error.message || 'Error desconocido al procesar la imagen.'}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onSave(formData);
    navigate('/dashboard');
  };

  const openInGoogleMaps = () => {
    const query = formData.location || 'salones de fiestas';
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen pb-24 max-w-[480px] mx-auto overflow-x-hidden relative text-slate-900 dark:text-white">
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-bold">Personalizar Invitación</h1>
        <button onClick={handleSave} className="text-primary font-bold text-sm">Guardar</button>
      </header>

      <div className="p-4 space-y-6">
        <div className="rounded-3xl bg-white dark:bg-slate-800 shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">
          <div className="relative aspect-[3/4] bg-slate-200 dark:bg-slate-900">
            {formData.image ? (
              <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">Sin imagen</div>
            )}

            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <button
                onClick={() => setShowAiModal(true)}
                className="size-11 flex items-center justify-center bg-primary/90 backdrop-blur-md text-white rounded-full border border-white/40 hover:bg-primary transition-all shadow-lg"
              >
                <span className="material-symbols-outlined">auto_awesome</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="size-11 flex items-center justify-center bg-white/90 backdrop-blur-md text-slate-800 rounded-full border border-slate-200 hover:bg-white transition-all shadow-lg"
              >
                <span className="material-symbols-outlined">upload_file</span>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>
            <div className="absolute bottom-6 left-6 right-6 text-white text-center">
              <h2 className="text-3xl font-bold leading-tight mb-2 font-serif">{formData.eventName}</h2>
              <p className="text-sm font-medium text-white/90 italic">{formData.message}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <section className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Detalles del Evento</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Título del Evento</label>
                <input type="text" name="eventName" value={formData.eventName} onChange={handleChange} className="w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900 p-4" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Fecha</label>
                  <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Hora</label>
                  <input type="time" name="time" value={formData.time} onChange={handleChange} className="w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900" />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Ubicación</label>
                  <button onClick={openInGoogleMaps} className="text-[10px] font-bold text-primary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">map</span> MAPAS
                  </button>
                </div>
                <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Frase / Dedicatoria</label>
                <textarea name="message" value={formData.message} onChange={handleChange} rows={3} className="w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900" />
              </div>
            </div>
          </section>

          <section ref={giftsRef} className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Regalos</h3>
            <div className="space-y-4">
              <select name="giftType" value={formData.giftType} onChange={handleChange} className="w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900">
                <option value="alias">Alias Bancario</option>
                <option value="list">Sitio de Compras</option>
              </select>
              <input type="text" name="giftDetail" value={formData.giftDetail} onChange={handleChange} className="w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900" placeholder="Alias o URL de lista" />
            </div>
          </section>
        </div>
      </div>

      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">IA Designer</h3>
              <button onClick={() => setShowAiModal(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} className="w-full rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900 p-4" rows={4} placeholder="Describe el fondo que deseas..." />
            <div className="flex gap-3">
              <button onClick={() => handleAiAction('generate')} className="flex-1 h-12 bg-primary text-white font-bold rounded-xl disabled:opacity-50" disabled={aiLoading || !aiPrompt.trim()}>Generar</button>
              <button onClick={() => handleAiAction('edit')} className="flex-1 h-12 border border-primary text-primary font-bold rounded-xl" disabled={aiLoading || !aiPrompt.trim() || !formData.image}>Editar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvitationEditor;
