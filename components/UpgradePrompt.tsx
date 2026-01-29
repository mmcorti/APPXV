import React from 'react';
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

    const isFree = currentPlan === PLANS_FE.FREE;
    const isAtLimit = currentCount >= limit;

    // Logic: 
    // If Free: Show always if showAlways is true, OR if at limit.
    // If Paid: Show ONLY if at limit.

    const shouldShow = isFree ? (showAlways || isAtLimit) : isAtLimit;

    if (!shouldShow) return null;

    const getNextPlanName = () => {
        if (currentPlan === PLANS_FE.FREE) return 'Invitado Especial';
        if (currentPlan === PLANS_FE.PREMIUM) return 'VIP';
        return 'Honor';
    };

    const getNextLimit = () => {
        // This logic could be more dynamic by looking up the next plan in PLAN_LIMITS_FE, but for now hardcoded for simplicity of UX message
        if (currentPlan === PLANS_FE.FREE) return '100';
        if (currentPlan === PLANS_FE.PREMIUM) return '200';
        return 'Ilimitado';
    };

    return (
        <div className={`
            flex flex-col md:flex-row items-center justify-between gap-4 
            p-4 rounded-xl border
            ${isAtLimit
                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'
                : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30'}
            transition-all animate-in fade-in slide-in-from-bottom-2
        `}>
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
                    px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap shadow-sm hover:shadow-md transition-all
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
