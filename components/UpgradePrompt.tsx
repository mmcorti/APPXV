import React, { useState } from 'react';
import { usePlan, PLANS_FE } from '../hooks/usePlan';
import { useNavigate } from 'react-router-dom';

interface UpgradePromptProps {
    resourceName: string;
    currentCount: number;
    limit: number;
    showAlways?: boolean;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({ resourceName, currentCount, limit, showAlways = false }) => {
    const { currentPlan } = usePlan();
    const navigate = useNavigate();
    const [isDismissed, setIsDismissed] = useState(false);

    const isFree = currentPlan === PLANS_FE.FREE;
    const isAtLimit = currentCount >= limit;

    // Logic: 
    // If Free: Show always if showAlways is true, OR if at limit.
    // If Paid: Show ONLY if at limit.

    const shouldShow = isFree ? (showAlways || isAtLimit) : isAtLimit;

    if (!shouldShow || isDismissed) return null;

    const getNextPlanName = () => {
        if (currentPlan === PLANS_FE.FREE) return 'Invitado Especial';
        if (currentPlan === PLANS_FE.PREMIUM) return 'VIP';
        return 'Honor';
    };

    const getNextLimit = () => {
        if (resourceName === 'eventos') {
            if (currentPlan === PLANS_FE.FREE) return '5';
            if (currentPlan === PLANS_FE.PREMIUM) return '20';
        } else if (resourceName === 'invitados') {
            if (currentPlan === PLANS_FE.FREE) return '100';
            if (currentPlan === PLANS_FE.PREMIUM) return '200';
        }
        return 'Ilimitado';
    };

    return (
        <div className={`
            relative flex flex-col md:flex-row items-center justify-between gap-4 
            p-5 rounded-[32px] border pr-12
            ${isAtLimit
                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 shadow-[0_10px_30px_rgba(239,68,68,0.1)]'
                : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30 shadow-[0_10px_30px_rgba(59,130,246,0.1)]'}
            transition-all animate-in fade-in slide-in-from-bottom-2
        `}>
            <button
                onClick={() => setIsDismissed(true)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Cerrar banner"
            >
                <span className="material-symbols-outlined text-xl">close</span>
            </button>
            <div className="flex items-start gap-3">
                <span className={`material-symbols-outlined ${isAtLimit ? 'text-red-500' : 'text-blue-500'}`}>
                    {isAtLimit ? 'lock' : 'info'}
                </span>
                <div>
                    <h4 className={`text-sm font-bold ${isAtLimit ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}>
                        {isAtLimit
                            ? `Has alcanzado el límite de ${limit} ${resourceName}`
                            : `Tu plan permite hasta ${limit} ${resourceName}`
                        }
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        El plan <span className="font-bold">{getNextPlanName()}</span> permite hasta <span className="font-bold">{getNextLimit()} {resourceName}.</span>
                    </p>
                </div>
            </div>

            <button
                onClick={() => navigate('/prices')} // Assuming /prices or back to welcome/upgrade page
                className={`
                    px-6 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider whitespace-nowrap shadow-sm hover:shadow-md transition-all
                    ${isAtLimit
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-white text-blue-600 hover:bg-blue-50 border border-blue-200'}
                `}
            >
                {isAtLimit ? 'Mejorar Plan' : 'Ver Planes'}
            </button>
        </div>
    );
};
