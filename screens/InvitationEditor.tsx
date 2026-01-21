import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { InvitationData, ImageSize, User } from '../types';
import { GeminiService } from '../services/gemini';
import { notionService } from '../services/notion';

interface InvitationEditorProps {
  invitations: InvitationData[];
  onSave: (data: InvitationData) => void;
  user: User;
}

const InvitationEditor: React.FC<InvitationEditorProps> = ({ invitations, onSave, user }) => {
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
  const [uploadLoading, setUploadLoading] = useState(false);

  // Cropping State
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

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
        // Keep as base64 locally - will upload to Cloudinary only when saving
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAiAction = async (type: 'generate' | 'edit') => {
    // PLAN CHECK: Only Premium/VIP can use AI
    if (user.plan === 'freemium') {
      alert('La generación de imágenes con IA está disponible para cuentas Premium y VIP.');
      return;
    }

    if (!aiPrompt) return;
    setAiLoading(true);
    setAiError('');

    try {
      let resultUrl = '';
      if (type === 'generate') {
        resultUrl = await notionService.generateAiImage(aiPrompt);
      } else {
        resultUrl = await notionService.editAiImage(formData.image, aiPrompt);
      }

      setFormData(prev => ({ ...prev, image: resultUrl }));
      setShowAiModal(false);
      setAiPrompt('');
      // Reset cropping for new AI image
      setZoom(1);
      setCrop({ x: 0, y: 0 });
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

  const [saving, setSaving] = useState(false);

  const getCroppedImg = (imageSrc: string, pixelCrop: any) => {
    return new Promise<string>((resolve, reject) => {
      const image = new Image();
      image.src = imageSrc;
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject();

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        ctx.drawImage(
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          pixelCrop.width,
          pixelCrop.height
        );

        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      image.onerror = (e) => reject(e);
      // For cross-origin images (Cloudinary)
      image.crossOrigin = 'anonymous';
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let dataToSave = { ...formData };

      // CROP THE IMAGE BEFORE SAVING
      if (dataToSave.image && croppedAreaPixels) {
        console.log('✂️ Cropping image...');
        const croppedImage = await getCroppedImg(dataToSave.image, croppedAreaPixels);
        dataToSave.image = croppedImage;
      }

      // If image is base64 (not a URL) or was just cropped, upload to Cloudinary
      if (dataToSave.image && dataToSave.image.startsWith('data:')) {
        console.log('📤 Uploading fixed image to Cloudinary...');
        const cloudinaryUrl = await notionService.uploadImage(dataToSave.image);
        dataToSave.image = cloudinaryUrl;
      }

      onSave(dataToSave);
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error saving:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const openInGoogleMaps = () => {
    const query = formData.location || 'salones de fiestas';
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen pb-24 max-w-[480px] md:max-w-4xl mx-auto overflow-x-hidden relative text-slate-900 dark:text-white">
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-bold">Personalizar Invitación</h1>
        <button onClick={handleSave} disabled={saving} className="text-primary font-bold text-sm disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </header>

      <div className="p-4 space-y-6">
        <div className="rounded-3xl bg-white dark:bg-slate-800 shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">
          <div className="relative aspect-[3/4] bg-slate-200 dark:bg-slate-900">
            {formData.image ? (
              <div className="relative w-full h-full">
                <Cropper
                  image={formData.image}
                  crop={crop}
                  zoom={zoom}
                  aspect={3 / 4}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  showGrid={false}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">Sin imagen</div>
            )}

            {aiLoading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-white">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                  <span className="text-sm font-bold">Generando con IA...</span>
                  <span className="text-xs text-slate-300">Esto puede tardar unos segundos</span>
                </div>
              </div>
            )}

            {uploadLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-white">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  <span className="text-sm font-medium">Subiendo imagen...</span>
                </div>
              </div>
            )}

            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <button
                onClick={() => setShowAiModal(true)}
                disabled={uploadLoading}
                className="size-11 flex items-center justify-center bg-primary/90 backdrop-blur-md text-white rounded-full border border-white/40 hover:bg-primary transition-all shadow-lg disabled:opacity-50"
              >
                <span className="material-symbols-outlined">auto_awesome</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading}
                className="size-11 flex items-center justify-center bg-white/90 backdrop-blur-md text-slate-800 rounded-full border border-slate-200 hover:bg-white transition-all shadow-lg disabled:opacity-50"
              >
                <span className="material-symbols-outlined">upload_file</span>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>

            {/* Zoom Slider Overlay */}
            {formData.image && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-48 bg-black/60 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 z-20">
                <span className="material-symbols-outlined text-white text-sm">zoom_out</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e: any) => setZoom(e.target.value)}
                  className="w-full accent-primary h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                />
                <span className="material-symbols-outlined text-white text-sm">zoom_in</span>
              </div>
            )}

            <div className="absolute bottom-6 left-6 right-6 text-white text-center pointer-events-none">
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

          <section className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Dress Code</h3>
            <div>
              <input type="text" name="dressCode" value={formData.dressCode || ''} onChange={handleChange} className="w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900 p-4" placeholder="Ej: Elegante, Formal, Casual..." />
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
