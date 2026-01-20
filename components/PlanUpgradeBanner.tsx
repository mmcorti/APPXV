import React from 'react';

interface PlanUpgradeBannerProps {
    currentPlan: 'freemium' | 'premium' | 'vip' | undefined;
    resourceType: 'events' | 'guests' | 'photos' | 'staff';
    current: number;
    limit: number;
    className?: string;
}

const PLAN_CONFIG = {
    freemium: {
        nextPlan: 'Premium',
        color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
        buttonColor: 'bg-purple-500 hover:bg-purple-600 text-white',
        limits: { events: 1, guests: 50, photos: 20, staff: 3 },
        nextLimits: { events: 5, guests: 200, photos: 200, staff: 20 }
    },
    premium: {
        nextPlan: 'VIP',
        color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
        buttonColor: 'bg-amber-500 hover:bg-amber-600 text-white',
        limits: { events: 5, guests: 200, photos: 200, staff: 20 },
        nextLimits: { events: Infinity, guests: Infinity, photos: 1000, staff: Infinity }
    },
    vip: {
        nextPlan: null,
        color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
        buttonColor: '',
        limits: { events: Infinity, guests: Infinity, photos: 1000, staff: Infinity },
        nextLimits: { events: Infinity, guests: Infinity, photos: Infinity, staff: Infinity }
    }
};

const RESOURCE_LABELS: Record<string, { singular: string; plural: string; icon: string }> = {
    events: { singular: 'evento', plural: 'eventos', icon: 'event' },
    guests: { singular: 'invitado', plural: 'invitados', icon: 'group' },
    photos: { singular: 'foto', plural: 'fotos', icon: 'photo_library' },
    staff: { singular: 'staff', plural: 'staff', icon: 'badge' }
};

const PlanUpgradeBanner: React.FC<PlanUpgradeBannerProps> = ({
    currentPlan = 'freemium',
    resourceType,
    current,
    limit,
    className = ''
}) => {
    // VIP users don't see upgrade prompts (unlimited)
    if (currentPlan === 'vip') return null;

    const config = PLAN_CONFIG[currentPlan] || PLAN_CONFIG.freemium;
    const resource = RESOURCE_LABELS[resourceType];
    const nextLimit = config.nextLimits[resourceType];
    const percentage = limit > 0 ? Math.round((current / limit) * 100) : 0;
    const isNearLimit = percentage >= 80;
    const isAtLimit = current >= limit;

    // Don't show if limit is infinite
    if (limit === Infinity) return null;

    const handleUpgradeClick = () => {
        // TODO: Implement payment flow
        alert(`¡Próximamente! Podrás actualizar a ${config.nextPlan} para obtener más beneficios.`);
    };

    return (
        <div className={`flex items-center justify-between gap-3 px-3 py-2 border rounded-xl text-xs font-medium ${config.color} ${className}`}>
            <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">{resource.icon}</span>
                <span>
                    {isAtLimit ? (
                        <>
                            <span className="font-bold text-red-600">Límite alcanzado</span>
                            <span className="opacity-70"> ({current}/{limit} {resource.plural})</span>
                        </>
                    ) : (
                        <>
                            <span className="font-bold">{current}/{limit}</span>
                            <span className="opacity-70"> {resource.plural}</span>
                            {isNearLimit && <span className="ml-1">⚠️</span>}
                        </>
                    )}
                </span>
            </div>

            {config.nextPlan && (
                <button
                    onClick={handleUpgradeClick}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 ${config.buttonColor}`}
                >
                    {isAtLimit ? `Hazte ${config.nextPlan}` : `→ ${config.nextPlan}`}
                    {nextLimit !== Infinity && ` (${nextLimit})`}
                </button>
            )}
        </div>
    );
};

export default PlanUpgradeBanner;
