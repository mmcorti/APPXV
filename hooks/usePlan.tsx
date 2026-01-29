import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// I will replicate the constants here for now to avoid build issues, or move them to a shared folder.
// Since I cannot easily move files to shared without verifying structure, I'll define them here.

export const PLANS_FE = {
    FREE: 'freemium',
    PREMIUM: 'premium',
    VIP: 'vip',
    HONOR: 'honor'
};

export const PLAN_LIMITS_FE = {
    freemium: {
        maxEvents: 1,
        maxGuestsPerEvent: 40,
        maxSubscribers: 0,
        maxStaffRoster: 3,
        maxPhotosPerEvent: 20,
        maxTriviaQuestions: 5,
        maxGameParticipants: 20,
        maxExpenses: 10,
        maxSuppliers: 3,
        maxParticipants: 2,
        aiFeatures: false,
        aiModeration: false,
        moderation: 'manual',
        gameAi: false
    },
    premium: {
        maxEvents: 5,
        maxGuestsPerEvent: 100,
        maxSubscribers: 0,
        maxStaffRoster: 20,
        maxPhotosPerEvent: 200,
        maxTriviaQuestions: 40,
        maxGameParticipants: 120,
        maxExpenses: 50,
        maxSuppliers: 20,
        maxParticipants: 10,
        aiFeatures: true,
        aiModeration: true,
        moderation: 'ai-basic',
        gameAi: true
    },
    vip: {
        maxEvents: 20,
        maxGuestsPerEvent: 200,
        maxSubscribers: 0,
        maxStaffRoster: 50,
        maxPhotosPerEvent: 500,
        maxTriviaQuestions: Infinity,
        maxGameParticipants: 300,
        maxExpenses: 500,
        maxSuppliers: 50,
        maxParticipants: 50,
        aiFeatures: true,
        aiModeration: true,
        moderation: 'ai-advanced',
        gameAi: true
    },
    honor: {
        maxEvents: 100,
        maxGuestsPerEvent: 1000,
        maxSubscribers: Infinity,
        maxStaffRoster: 100,
        maxPhotosPerEvent: 2000,
        maxTriviaQuestions: Infinity,
        maxGameParticipants: 1000,
        maxExpenses: Infinity,
        maxSuppliers: Infinity,
        maxParticipants: Infinity,
        aiFeatures: true,
        aiModeration: true,
        moderation: 'ai-advanced',
        gameAi: true
    }
};

const DEFAULT_PLAN = PLANS_FE.FREE;

interface PlanContextType {
    currentPlan: string;
    limits: typeof PLAN_LIMITS_FE.freemium;
    checkLimit: (resource: keyof typeof PLAN_LIMITS_FE.freemium, currentCount: number) => { allowed: boolean; limit: number; remaining: number };
    canAccess: (feature: keyof typeof PLAN_LIMITS_FE.freemium) => boolean;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export const PlanProvider: React.FC<{ children: ReactNode; userPlan?: string }> = ({ children, userPlan }) => {
    // Memoize the context value to prevent unnecessary re-renders of children
    const value = React.useMemo(() => {
        // Normalize plan or default to free
        // Mapping from lowercase plan names to PLANS_FE keys
        const planMapping: Record<string, string> = {
            'freemium': 'FREE',
            'premium': 'PREMIUM',
            'vip': 'VIP',
            'honor': 'HONOR'
        };

        const key = planMapping[userPlan?.toLowerCase() || ''] || 'FREE';
        const currentPlan = PLANS_FE[key as keyof typeof PLANS_FE] || PLANS_FE.FREE;
        const limits = PLAN_LIMITS_FE[currentPlan as keyof typeof PLAN_LIMITS_FE] || PLAN_LIMITS_FE.freemium;

        const checkLimit = (resource: keyof typeof PLAN_LIMITS_FE.freemium, currentCount: number) => {
            const limit = (limits[resource] as number) ?? 0;
            if (limit === Infinity) return { allowed: true, limit: Infinity, remaining: Infinity };

            return {
                allowed: currentCount < limit,
                limit,
                remaining: Math.max(0, limit - currentCount)
            };
        };

        const canAccess = (feature: keyof typeof PLAN_LIMITS_FE.freemium) => {
            return !!limits[feature];
        };

        return { currentPlan, limits, checkLimit, canAccess };
    }, [userPlan]);

    return (
        <PlanContext.Provider value={value}>
            {children}
        </PlanContext.Provider>
    );
};

export const usePlan = () => {
    const context = useContext(PlanContext);
    if (!context) {
        throw new Error('usePlan must be used within a PlanProvider');
    }
    return context;
};
