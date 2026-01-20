import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User } from '../types';

type ModerationMode = 'off' | 'ai' | 'manual';

interface FilterSettings {
    // Visual Filters
    nudity: boolean;
    suggestivePoses: boolean;
    violence: boolean;
    hateSymbols: boolean;
    drugs: boolean;
    // Text Filters
    offensiveLanguage: boolean;
    hateSpeech: boolean;
    personalData: boolean;
    // Settings
    confidenceThreshold: number;
}

const DEFAULT_FILTERS: FilterSettings = {
    nudity: true,
    suggestivePoses: false, // Off by default - party photos often have suggestive poses
    violence: true,
    hateSymbols: true,
    drugs: true,
    offensiveLanguage: true,
    hateSpeech: true,
    personalData: false,
    confidenceThreshold: 70
};

interface FotoWallModerationSettingsProps {
    user?: User | null;
}

const FotoWallModerationSettingsScreen: React.FC<FotoWallModerationSettingsProps> = ({ user }) => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();

    const storageKey = `fotowall_moderation_settings_${id}`;

    const [mode, setMode] = useState<ModerationMode>('ai');
    const [filters, setFilters] = useState<FilterSettings>(DEFAULT_FILTERS);
    const [saved, setSaved] = useState(false);

    const userPlan = user?.plan || 'freemium';

    // Load saved settings on mount
    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.mode) setMode(parsed.mode);
                if (parsed.filters) setFilters({ ...DEFAULT_FILTERS, ...parsed.filters });
            } catch (e) {
                console.error("Error loading moderation settings:", e);
            }
        }
    }, [id]);

    const handleSave = () => {
        const settings = { mode, filters };
        localStorage.setItem(storageKey, JSON.stringify(settings));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const toggleFilter = (key: keyof FilterSettings) => {
        if (key === 'confidenceThreshold') return;
        setFilters(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const FilterToggle = ({
        filterKey,
        title,
        description,
        icon
    }: {
        filterKey: keyof FilterSettings;
        title: string;
        description: string;
        icon: string;
    }) => {
        const isOn = filters[filterKey] as boolean;
        const disabled = mode === 'off';

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
                    className={`w-12 h-7 rounded-full transition-colors relative ${isOn && !disabled ? 'bg-pink-500' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                >
                    <div className={`absolute top-1 size-5 bg-white rounded-full shadow-md transition-transform ${isOn ? 'left-6' : 'left-1'
                        }`}></div>
                </button>
            </div>
        );
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen text-slate-900 dark:text-white font-display">
            <div className="max-w-[800px] mx-auto min-h-screen flex flex-col relative">
                {/* Header */}
                <div className="px-6 pt-8 pb-4">
                    <button
                        onClick={() => navigate(`/fotowall/${id}`)}
                        className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-bold text-sm mb-4 hover:text-primary transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">arrow_back</span>
                        Volver
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="size-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                            <span className="material-symbols-outlined text-2xl">tune</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">Configuración de Moderación</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                Personaliza los filtros de contenido
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 flex-1 pb-32 space-y-6">

                    {/* Moderation Mode */}
                    <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-4">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                            Modo de Moderación
                        </h2>

                        <div className="space-y-2">
                            {/* Off Mode */}
                            <button
                                onClick={() => setMode('off')}
                                className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${mode === 'off'
                                    ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                                    : 'border-slate-100 dark:border-slate-700 hover:border-slate-200'
                                    }`}
                            >
                                <div className={`size-10 rounded-xl flex items-center justify-center ${mode === 'off' ? 'bg-pink-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                    }`}>
                                    <span className="material-symbols-outlined">visibility_off</span>
                                </div>
                                <div className="text-left flex-1">
                                    <p className="font-bold">Sin Moderación</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                        Mostrar todas las fotos sin filtrar
                                    </p>
                                </div>
                                {mode === 'off' && (
                                    <span className="material-symbols-outlined text-pink-500">check_circle</span>
                                )}
                            </button>

                            {/* AI Mode */}
                            <div className="relative">
                                <button
                                    onClick={() => userPlan !== 'freemium' && setMode('ai')}
                                    className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${mode === 'ai'
                                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                                        : 'border-slate-100 dark:border-slate-700 hover:border-slate-200'
                                        } ${userPlan === 'freemium' ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    <div className={`size-10 rounded-xl flex items-center justify-center ${mode === 'ai' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                        }`}>
                                        <span className="material-symbols-outlined">smart_toy</span>
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="font-bold flex items-center gap-2">
                                            Moderación IA
                                            <span className="text-[8px] font-bold bg-gradient-to-r from-pink-500 to-purple-600 text-white px-1.5 py-0.5 rounded-full">AI</span>
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                            {userPlan === 'freemium' ? 'Disponible en planes Premium/VIP' : 'Análisis automático con IA (usa API)'}
                                        </p>
                                    </div>
                                    {mode === 'ai' && (
                                        <span className="material-symbols-outlined text-pink-500">check_circle</span>
                                    )}
                                    {userPlan === 'freemium' && (
                                        <span className="material-symbols-outlined text-amber-500">lock</span>
                                    )}
                                </button>
                                {userPlan === 'freemium' && (
                                    <div className="mt-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Actualiza para usar IA</span>
                                        <button onClick={() => alert('¡Hazte Premium!')} className="text-[10px] font-black text-pink-600 hover:text-pink-700 underline">VER PLANES</button>
                                    </div>
                                )}
                            </div>

                            {/* Manual Mode */}
                            <button
                                onClick={() => setMode('manual')}
                                className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${mode === 'manual'
                                    ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                                    : 'border-slate-100 dark:border-slate-700 hover:border-slate-200'
                                    }`}
                            >
                                <div className={`size-10 rounded-xl flex items-center justify-center ${mode === 'manual' ? 'bg-pink-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                    }`}>
                                    <span className="material-symbols-outlined">pan_tool</span>
                                </div>
                                <div className="text-left flex-1">
                                    <p className="font-bold">Moderación Manual</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                        Bloquear todo y aprobar manualmente (sin API)
                                    </p>
                                </div>
                                {mode === 'manual' && (
                                    <span className="material-symbols-outlined text-pink-500">check_circle</span>
                                )}
                            </button>
                        </div>
                    </section>

                    {/* Visual Filters */}
                    <section className={`bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-4 ${mode === 'off' ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-pink-500">visibility</span>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Filtros Visuales
                            </h2>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            <FilterToggle
                                filterKey="nudity"
                                title="Desnudez"
                                description="Desnudez total o parcial"
                                icon="no_adult_content"
                            />
                            <FilterToggle
                                filterKey="suggestivePoses"
                                title="Poses Sugerentes"
                                description="Poses provocativas (común en fiestas)"
                                icon="accessibility_new"
                            />
                            <FilterToggle
                                filterKey="violence"
                                title="Violencia y Gore"
                                description="Armas, peleas, sangre, accidentes"
                                icon="swords"
                            />
                            <FilterToggle
                                filterKey="hateSymbols"
                                title="Símbolos de Odio"
                                description="Símbolos discriminatorios o extremistas"
                                icon="block"
                            />
                            <FilterToggle
                                filterKey="drugs"
                                title="Drogas y Sustancias"
                                description="Drogas, parafernalia, consumo de alcohol"
                                icon="medication"
                            />
                        </div>
                    </section>

                    {/* Text Filters */}
                    <section className={`bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-4 ${mode === 'off' ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-pink-500">text_fields</span>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Filtros de Texto
                            </h2>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            <FilterToggle
                                filterKey="offensiveLanguage"
                                title="Lenguaje Ofensivo"
                                description="Insultos, groserías, palabras vulgares"
                                icon="sentiment_very_dissatisfied"
                            />
                            <FilterToggle
                                filterKey="hateSpeech"
                                title="Discurso de Odio"
                                description="Contenido discriminatorio o amenazante"
                                icon="warning"
                            />
                            <FilterToggle
                                filterKey="personalData"
                                title="Datos Personales"
                                description="Teléfonos, direcciones, información sensible"
                                icon="lock"
                            />
                        </div>
                    </section>

                    {/* Confidence Threshold (only for AI mode) */}
                    {mode === 'ai' && (
                        <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-4">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                                Umbral de Confianza
                            </h2>

                            <div className="space-y-3">
                                <input
                                    type="range"
                                    min="50"
                                    max="95"
                                    value={filters.confidenceThreshold}
                                    onChange={(e) => setFilters(prev => ({ ...prev, confidenceThreshold: parseInt(e.target.value) }))}
                                    className="w-full accent-pink-500"
                                />
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>Permisivo</span>
                                    <span className="font-bold text-pink-500">{filters.confidenceThreshold}%</span>
                                    <span>Estricto</span>
                                </div>
                                <p className="text-[10px] text-slate-400 text-center">
                                    A mayor porcentaje, más estricto será el filtrado
                                </p>
                            </div>
                        </section>
                    )}

                </div>

                {/* Save Button */}
                <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light dark:via-background-dark to-transparent">
                    <div className="max-w-[800px] mx-auto">
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
                    </div>
                </div>

            </div>
        </div>
    );
};

export default FotoWallModerationSettingsScreen;
