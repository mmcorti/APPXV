import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { InvitationData } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000/api';

// Types
type ModerationMode = 'ai' | 'manual';
type TabType = 'rules' | 'moderation';

interface FilterSettings {
  nudity: boolean;
  suggestivePoses: boolean;
  violence: boolean;
  hateSymbols: boolean;
  drugs: boolean;
  offensiveLanguage: boolean;
  hateSpeech: boolean;
  personalData: boolean;
  confidenceThreshold: number;
}

const DEFAULT_FILTERS: FilterSettings = {
  nudity: true,
  suggestivePoses: false,
  violence: true,
  hateSymbols: true,
  drugs: true,
  offensiveLanguage: true,
  hateSpeech: true,
  personalData: false,
  confidenceThreshold: 70
};

interface FotoWallConfigProps {
  invitations: InvitationData[];
}

const FotoWallConfigScreen: React.FC<FotoWallConfigProps> = ({ invitations }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const event = invitations.find(i => i.id === id);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('rules');

  // Config state
  const [albumUrl, setAlbumUrl] = useState('');
  const [intervalValue, setIntervalValue] = useState(5);
  const [shuffle, setShuffle] = useState(false);
  const [overlayTitle, setOverlayTitle] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [linkStatus, setLinkStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [saved, setSaved] = useState(false);

  // Moderation settings state
  const [mode, setMode] = useState<ModerationMode>('manual');
  const [filters, setFilters] = useState<FilterSettings>(DEFAULT_FILTERS);

  // Moderation panel state
  const [allPhotos, setAllPhotos] = useState<any[]>([]);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  // Storage keys
  const configKey = `fotowall_config_${id}`;
  const moderationKey = `fotowall_moderation_settings_${id}`;

  // Load saved config on mount
  useEffect(() => {
    // Load config
    const savedConfig = localStorage.getItem(configKey);
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (config.albumUrl) {
          setAlbumUrl(config.albumUrl);
          setLinkStatus('valid');
        }
        if (config.interval) setIntervalValue(config.interval);
        if (config.shuffle !== undefined) setShuffle(config.shuffle);
        if (config.overlayTitle) setOverlayTitle(config.overlayTitle);
      } catch (e) {
        console.error("Error loading config:", e);
      }
    }

    // Load moderation settings
    const savedModeration = localStorage.getItem(moderationKey);
    if (savedModeration) {
      try {
        const settings = JSON.parse(savedModeration);
        if (settings.mode) setMode(settings.mode);
        if (settings.filters) setFilters(prev => ({ ...prev, ...settings.filters }));
      } catch (e) {
        console.error("Error loading moderation settings:", e);
      }
    }
  }, [id]);

  // Load all photos when moderation tab is active or mode changes
  useEffect(() => {
    if (activeTab === 'moderation' && albumUrl && linkStatus === 'valid') {
      loadAllPhotos();
    }
  }, [activeTab, albumUrl, linkStatus, mode]);

  // Validate link
  const validateLink = async (url: string) => {
    if (!url) return;
    setIsValidating(true);
    setLinkStatus('idle');

    try {
      const res = await fetch(`${API_URL}/fotowall/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();

      if (data.valid) {
        setLinkStatus('valid');
        setStatusMessage(`✓ ${data.count} fotos encontradas`);
        localStorage.setItem(`fotowall_url_${id}`, url);
      } else {
        setLinkStatus('invalid');
        setStatusMessage(data.message || 'Link inválido');
      }
    } catch (e) {
      setLinkStatus('invalid');
      setStatusMessage('Error de conexión');
    } finally {
      setIsValidating(false);
    }
  };

  // Load ALL photos with moderation status
  const loadAllPhotos = async () => {
    console.log('[FOTOWALL] loadAllPhotos called, albumUrl:', albumUrl, 'mode:', mode);
    if (!albumUrl) {
      console.log('[FOTOWALL] No albumUrl, skipping load');
      return;
    }
    setIsLoadingPhotos(true);
    try {
      console.log('[FOTOWALL] Fetching photos from:', `${API_URL}/fotowall/all-photos`);
      const res = await fetch(`${API_URL}/fotowall/all-photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: albumUrl,
          moderationSettings: { mode, filters }
        })
      });
      const data = await res.json();
      console.log('[FOTOWALL] Response:', data);

      if (data.photos) {
        setAllPhotos(data.photos);
        setTotalPhotos(data.total || data.photos.length);
        setBlockedCount(data.blocked || 0);
      }
    } catch (e) {
      console.error("Error loading photos:", e);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  // Save config settings
  const handleSave = () => {
    // Save config
    const config = { albumUrl, interval: intervalValue, shuffle, overlayTitle };
    localStorage.setItem(configKey, JSON.stringify(config));
    localStorage.setItem(`fotowall_url_${id}`, albumUrl);

    // Save moderation settings
    const moderationSettings = { mode, filters };
    localStorage.setItem(moderationKey, JSON.stringify(moderationSettings));

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Toggle filter
  const toggleFilter = (key: keyof FilterSettings) => {
    if (key === 'confidenceThreshold') return;
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter Toggle Component
  const FilterToggle = ({ filterKey, title, description, icon }: {
    filterKey: keyof FilterSettings;
    title: string;
    description: string;
    icon: string;
  }) => {
    const isOn = filters[filterKey] as boolean;
    const disabled = mode !== 'ai';

    return (
      <div className={`flex items-center justify-between py-3 ${disabled ? 'opacity-40' : ''}`}>
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-xl text-pink-500">{icon}</span>
          <div className="flex-1">
            <p className="font-bold text-sm">{title}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        <button
          onClick={() => toggleFilter(filterKey)}
          disabled={disabled}
          className={`w-12 h-7 rounded-full transition-colors relative ${isOn && !disabled ? 'bg-pink-500' : 'bg-slate-200 dark:bg-slate-700'}`}
        >
          <div className={`absolute top-1 size-5 bg-white rounded-full shadow-md transition-transform ${isOn ? 'left-6' : 'left-1'}`}></div>
        </button>
      </div>
    );
  };

  // Approve single photo
  const handleApprove = async (photoId: string) => {
    setActionLoading(photoId);
    try {
      await fetch(`${API_URL}/fotowall/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: albumUrl, photoId })
      });
      // Update local state
      setAllPhotos(prev => prev.map(p =>
        p.id === photoId ? { ...p, isBlocked: false, isApproved: true } : p
      ));
      setBlockedCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error("Error approving photo:", e);
    } finally {
      setActionLoading(null);
    }
  };

  // Block single photo
  const handleBlock = async (photoId: string) => {
    setActionLoading(photoId);
    try {
      await fetch(`${API_URL}/fotowall/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: albumUrl, photoId })
      });
      // Update local state
      setAllPhotos(prev => prev.map(p =>
        p.id === photoId ? { ...p, isBlocked: true, isApproved: false } : p
      ));
      setBlockedCount(prev => prev + 1);
    } catch (e) {
      console.error("Error blocking photo:", e);
    } finally {
      setActionLoading(null);
    }
  };

  // Approve ALL photos (No Moderar)
  const handleApproveAll = async () => {
    if (!albumUrl) return;
    setActionLoading('all');
    try {
      await fetch(`${API_URL}/fotowall/approve-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: albumUrl })
      });
      // Update local state - all photos approved
      setAllPhotos(prev => prev.map(p => ({ ...p, isBlocked: false, isApproved: true })));
      setBlockedCount(0);
    } catch (e) {
      console.error("Error approving all:", e);
    } finally {
      setActionLoading(null);
    }
  };

  // Block ALL photos (Bloquear Todo)
  const handleBlockAll = async () => {
    if (!albumUrl) return;
    setActionLoading('all');
    try {
      await fetch(`${API_URL}/fotowall/block-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: albumUrl })
      });
      // Update local state - all photos blocked
      setAllPhotos(prev => prev.map(p => ({ ...p, isBlocked: true, isApproved: false })));
      setBlockedCount(totalPhotos);
    } catch (e) {
      console.error("Error blocking all:", e);
    } finally {
      setActionLoading(null);
    }
  };

  // Label translation map for moderation status
  const labelMap: Record<string, string> = {
    'manually_blocked': 'Bloqueado',
    'blocked_all': 'Bloqueado',
    'manually_approved': 'Aprobado',
    'approved_all': 'Aprobado'
  };

  if (!event) return null;

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen text-slate-900 dark:text-white font-display">
      <div className="max-w-[480px] mx-auto min-h-screen flex flex-col relative">
        {/* Header */}
        <div className="px-6 pt-8 pb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-bold text-sm mb-4 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Volver
          </button>

          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-600">
            FotoWall
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {event.eventName}
          </p>
        </div>

        {/* Tabs */}
        <div className="px-6 mb-4">
          <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 flex">
            <button
              onClick={() => setActiveTab('rules')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'rules'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
                }`}
            >
              Reglas
            </button>
            <button
              onClick={() => setActiveTab('moderation')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'moderation'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
                }`}
            >
              Panel de Moderación
              {blockedCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {blockedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-6 flex-1 pb-32">
          {activeTab === 'rules' ? (
            /* RULES TAB */
            <div className="space-y-6">
              {/* Album URL */}
              <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Fuente de Fotos</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={albumUrl}
                    onChange={(e) => setAlbumUrl(e.target.value)}
                    onBlur={() => validateLink(albumUrl)}
                    placeholder="https://photos.app.goo.gl/..."
                    className={`flex-1 bg-slate-50 dark:bg-slate-900 border-2 rounded-xl px-4 py-3 text-sm ${linkStatus === 'valid' ? 'border-green-500' : linkStatus === 'invalid' ? 'border-red-500' : 'border-transparent'}`}
                  />
                  <button
                    onClick={() => validateLink(albumUrl)}
                    className="bg-pink-100 dark:bg-pink-900/30 text-pink-600 rounded-xl px-4"
                    title="Validar link"
                  >
                    {isValidating ? (
                      <span className="material-symbols-outlined animate-spin">refresh</span>
                    ) : (
                      <span className="material-symbols-outlined">check_circle</span>
                    )}
                  </button>
                </div>
                {statusMessage && (
                  <p className={`text-xs mt-2 ${linkStatus === 'valid' ? 'text-green-500' : 'text-red-500'}`}>
                    {statusMessage}
                  </p>
                )}
                {/* Quick action buttons */}
                {linkStatus === 'valid' && albumUrl && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => window.open(albumUrl, '_blank')}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold py-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      Abrir Álbum
                    </button>
                    <button
                      onClick={() => setShowQRModal(true)}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold py-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">qr_code_2</span>
                      Código QR
                    </button>
                  </div>
                )}
              </section>

              {/* Moderation Mode */}
              <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Modo de Moderación</h2>
                <div className="space-y-2">
                  {/* AI */}
                  <button
                    onClick={() => setMode('ai')}
                    className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${mode === 'ai' ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20' : 'border-slate-100 dark:border-slate-700'}`}
                  >
                    <div className={`size-10 rounded-xl flex items-center justify-center ${mode === 'ai' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                      <span className="material-symbols-outlined">smart_toy</span>
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-bold flex items-center gap-2">
                        Moderación IA
                        <span className="text-[8px] font-bold bg-gradient-to-r from-pink-500 to-purple-600 text-white px-1.5 py-0.5 rounded-full">AI</span>
                      </p>
                      <p className="text-[10px] text-slate-500">Análisis automático con IA (usa API)</p>
                    </div>
                    {mode === 'ai' && <span className="material-symbols-outlined text-pink-500">check_circle</span>}
                  </button>

                  {/* Manual */}
                  <button
                    onClick={() => setMode('manual')}
                    className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${mode === 'manual' ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20' : 'border-slate-100 dark:border-slate-700'}`}
                  >
                    <div className={`size-10 rounded-xl flex items-center justify-center ${mode === 'manual' ? 'bg-pink-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                      <span className="material-symbols-outlined">pan_tool</span>
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-bold">Moderación Manual</p>
                      <p className="text-[10px] text-slate-500">Bloquear todo y aprobar manualmente (sin API)</p>
                    </div>
                    {mode === 'manual' && <span className="material-symbols-outlined text-pink-500">check_circle</span>}
                  </button>
                </div>
              </section>

              {/* Visual Filters - Only show when AI mode */}
              {mode === 'ai' && (
                <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-pink-500">visibility</span>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Filtros Visuales</h2>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    <FilterToggle filterKey="nudity" title="Desnudez" description="Desnudez total o parcial" icon="no_adult_content" />
                    <FilterToggle filterKey="suggestivePoses" title="Poses Sugerentes" description="Poses provocativas (común en fiestas)" icon="accessibility_new" />
                    <FilterToggle filterKey="violence" title="Violencia y Gore" description="Armas, peleas, sangre, accidentes" icon="swords" />
                    <FilterToggle filterKey="hateSymbols" title="Símbolos de Odio" description="Símbolos discriminatorios o extremistas" icon="block" />
                    <FilterToggle filterKey="drugs" title="Drogas y Sustancias" description="Drogas, parafernalia, consumo de alcohol" icon="medication" />
                  </div>
                </section>
              )}

              {/* Text Filters - Only show when AI mode */}
              {mode === 'ai' && (
                <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-pink-500">text_fields</span>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Filtros de Texto</h2>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    <FilterToggle filterKey="offensiveLanguage" title="Lenguaje Ofensivo" description="Insultos, groserías, palabras vulgares" icon="sentiment_very_dissatisfied" />
                    <FilterToggle filterKey="hateSpeech" title="Discurso de Odio" description="Contenido discriminatorio o amenazante" icon="warning" />
                    <FilterToggle filterKey="personalData" title="Datos Personales" description="Teléfonos, direcciones, información sensible" icon="lock" />
                  </div>
                </section>
              )}

              {/* Confidence Threshold - Only show when AI mode */}
              {mode === 'ai' && (
                <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Umbral de Confianza</h2>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    value={filters.confidenceThreshold}
                    onChange={(e) => setFilters(prev => ({ ...prev, confidenceThreshold: parseInt(e.target.value) }))}
                    className="w-full accent-pink-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-2">
                    <span>Permisivo</span>
                    <span className="font-bold text-pink-500">{filters.confidenceThreshold}%</span>
                    <span>Estricto</span>
                  </div>
                </section>
              )}

              {/* Interval */}
              <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-4">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Intervalo</h2>
                  <span className="text-xs font-bold text-pink-500 bg-pink-50 dark:bg-pink-900/20 px-2 py-1 rounded-lg">{intervalValue}s</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="30"
                  value={intervalValue}
                  onChange={(e) => setIntervalValue(parseInt(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </section>

              {/* Shuffle Toggle */}
              <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-xl text-pink-500">shuffle</span>
                    <div>
                      <p className="font-bold text-sm">Muestra Aleatoria</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {shuffle ? 'Las fotos se muestran en orden aleatorio' : 'Las fotos se muestran en orden secuencial, priorizando las nuevas'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShuffle(!shuffle)}
                    className={`w-12 h-7 rounded-full transition-colors relative ${shuffle ? 'bg-pink-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 size-5 bg-white rounded-full shadow-md transition-transform ${shuffle ? 'left-6' : 'left-1'}`}></div>
                  </button>
                </div>
              </section>

              {/* Overlay Title */}
              <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Texto en Pantalla</h2>
                <input
                  type="text"
                  value={overlayTitle}
                  onChange={(e) => setOverlayTitle(e.target.value)}
                  placeholder={event?.eventName || 'Fiesta'}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-transparent rounded-xl px-4 py-3 text-sm focus:border-pink-500 transition-colors"
                />
                <p className="text-[10px] text-slate-400 mt-2">
                  El nombre que aparece en la esquina inferior izquierda del player. Vacío usa el nombre del evento.
                </p>
              </section>
            </div>
          ) : (
            /* MODERATION PANEL */
            <div className="space-y-4">
              {/* Bulk Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleApproveAll}
                  disabled={actionLoading === 'all'}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined">check_circle</span>
                  No Moderar
                </button>
                <button
                  onClick={handleBlockAll}
                  disabled={actionLoading === 'all'}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined">block</span>
                  Bloquear Todo
                </button>
              </div>

              {/* Stats & Controls */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  {blockedCount}/{totalPhotos} fotos bloqueadas
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowImages(!showImages)}
                    className="flex items-center gap-1 text-xs font-bold text-pink-500 bg-pink-50 dark:bg-pink-900/30 px-3 py-2 rounded-xl"
                  >
                    <span className="material-symbols-outlined text-sm">{showImages ? 'visibility_off' : 'visibility'}</span>
                    {showImages ? 'Ocultar' : 'Mostrar'}
                  </button>
                  <button
                    onClick={loadAllPhotos}
                    className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded-xl"
                  >
                    <span className="material-symbols-outlined text-sm">refresh</span>
                    Actualizar
                  </button>
                </div>
              </div>

              {/* Photos Grid */}
              {isLoadingPhotos ? (
                <div className="flex items-center justify-center py-12">
                  <span className="material-symbols-outlined text-4xl text-pink-500 animate-spin">refresh</span>
                </div>
              ) : allPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <span className="material-symbols-outlined text-5xl mb-2">photo_library</span>
                  <p className="font-bold">Sin fotos</p>
                  <p className="text-xs">Configura una fuente de fotos primero</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {allPhotos.map(photo => (
                    <div key={photo.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                      {/* Image */}
                      <div className="aspect-square relative">
                        <img
                          src={photo.src}
                          alt="Photo"
                          className={`w-full h-full object-cover ${showImages ? '' : 'blur-xl brightness-50'}`}
                        />
                        {/* Status Badge */}
                        <div className="absolute top-2 right-2">
                          {photo.isBlocked ? (
                            <span className="bg-red-500/90 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">block</span>
                              Bloqueado
                            </span>
                          ) : (
                            <span className="bg-green-500/90 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">check</span>
                              Aprobado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(photo.id)}
                            disabled={actionLoading === photo.id || photo.isApproved}
                            className={`flex-1 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1 transition-all ${photo.isApproved
                              ? 'bg-green-100 text-green-400 cursor-not-allowed'
                              : 'bg-green-500 hover:bg-green-600 text-white'
                              }`}
                          >
                            <span className="material-symbols-outlined text-sm">check</span>
                            Aprobar
                          </button>
                          <button
                            onClick={() => handleBlock(photo.id)}
                            disabled={actionLoading === photo.id || photo.isBlocked}
                            className={`flex-1 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1 transition-all ${photo.isBlocked
                              ? 'bg-red-100 text-red-400 cursor-not-allowed'
                              : 'bg-red-500 hover:bg-red-600 text-white'
                              }`}
                          >
                            <span className="material-symbols-outlined text-sm">block</span>
                            Bloquear
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light dark:via-background-dark to-transparent">
          <div className="max-w-[480px] mx-auto space-y-3">
            {activeTab === 'rules' && (
              <button
                onClick={handleSave}
                className={`w-full font-bold h-14 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 ${saved
                  ? 'bg-green-500 text-white shadow-green-500/20'
                  : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-pink-500/20 active:scale-[0.98]'
                  }`}
              >
                {saved ? (
                  <>
                    <span className="material-symbols-outlined text-2xl">check</span>
                    Guardado
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-2xl">save</span>
                    Guardar Cambios
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => {
                handleSave();
                const playerConfig = { url: albumUrl, interval: intervalValue, shuffle };
                localStorage.setItem(`fotowall_player_${id}`, JSON.stringify(playerConfig));
                window.open(`/#/fotowall-player/${id}`, '_blank');
              }}
              disabled={linkStatus !== 'valid'}
              className={`w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold h-12 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 ${linkStatus !== 'valid' ? 'opacity-50' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              <span className="material-symbols-outlined text-xl">rocket_launch</span>
              Lanzar Presentación
            </button>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6" onClick={() => setShowQRModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Código QR del Álbum</h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="size-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(albumUrl)}`}
                alt="QR Code"
                className="w-full max-w-[250px]"
              />
            </div>

            <p className="text-xs text-slate-500 text-center mt-4">
              Escanea este código para acceder al álbum de fotos
            </p>

            <div className="flex gap-2 mt-4">
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(albumUrl)}`}
                download="album-qr.png"
                target="_blank"
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-bold py-3 rounded-xl"
              >
                <span className="material-symbols-outlined text-lg">download</span>
                Descargar QR
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FotoWallConfigScreen;
