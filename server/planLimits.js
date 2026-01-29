/**
 * Plan Limits Configuration
 * Defines subscription plan limits for different user tiers
 */

// Plan configuration constants
// Plan names mapping context for clearer usage
export const PLANS = {
    FREE: 'freemium',
    PREMIUM: 'premium',
    VIP: 'vip',
    HONOR: 'honor'
};

export const PLAN_LIMITS = {
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
        moderation: 'manual', // manual, ai-basic, ai-advanced
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
        aiModeration: true, // Google Vision
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
        aiModeration: true, // Advanced
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

// Default plan for new users
export const DEFAULT_PLAN = 'freemium';

/**
 * Get limits for a specific plan
 * @param {string} planName - The plan name (freemium, premium, vip)
 * @returns {Object} The plan limits
 */
export const getPlanLimits = (planName) => {
    const normalizedPlan = (planName || DEFAULT_PLAN).toLowerCase();
    return PLAN_LIMITS[normalizedPlan] || PLAN_LIMITS[DEFAULT_PLAN];
};

/**
 * Check if a user can create a new resource based on their plan limits
 * @param {Object} params
 * @param {string} params.plan - User's subscription plan
 * @param {string} params.resource - Resource type (events, guests, staffRoster)
 * @param {number} params.currentCount - Current count of the resource
 * @param {number} [params.eventId] - Event ID for guest limits (optional)
 * @returns {Object} { allowed: boolean, limit: number, reason?: string }
 */
export const checkLimit = ({ plan, resource, currentCount }) => {
    const limits = getPlanLimits(plan);

    let limit;
    let resourceName;

    switch (resource) {
        case 'events':
            limit = limits.maxEvents;
            resourceName = 'eventos';
            break;
        case 'guests':
            limit = limits.maxGuestsPerEvent;
            resourceName = 'invitados por evento';
            break;
        case 'staffRoster':
            limit = limits.maxStaffRoster;
            resourceName = 'miembros del staff';
            break;
        case 'triviaQuestions':
            limit = limits.maxTriviaQuestions;
            resourceName = 'preguntas de trivia';
            break;
        case 'gameParticipants':
        case 'bingoParticipants': // Backwards compatibility
            limit = limits.maxGameParticipants;
            resourceName = 'participantes del juego';
            break;
        case 'expenses':
            limit = limits.maxExpenses;
            resourceName = 'gastos';
            break;
        case 'suppliers':
            limit = limits.maxSuppliers;
            resourceName = 'proveedores';
            break;
        case 'participants': // Payment participants
            limit = limits.maxParticipants;
            resourceName = 'participantes de gastos';
            break;
        case 'subscribers':
            // Subscribers can only be created by admins
            return {
                allowed: false,
                limit: 0,
                reason: 'Solo los administradores pueden crear suscriptores'
            };
        default:
            return { allowed: true, limit: Infinity };
    }

    if (currentCount >= limit) {
        return {
            allowed: false,
            limit,
            reason: `Has alcanzado el límite de ${limit} ${resourceName} para tu plan ${plan}`
        };
    }

    return { allowed: true, limit, remaining: limit - currentCount };
};

/**
 * Check if user has admin role
 * @param {string} role - The user's role
 * @returns {boolean}
 */
export const isAdmin = (role) => {
    return role === 'admin';
};

/**
 * Get usage summary for a user
 * @param {Object} counts - Current resource counts
 * @param {string} plan - User's plan
 * @returns {Object} Usage summary with counts and limits
 */
export const getUsageSummary = (counts, plan) => {
    const limits = getPlanLimits(plan);

    return {
        events: {
            current: counts.events || 0,
            limit: limits.maxEvents,
            display: `${counts.events || 0}/${limits.maxEvents === Infinity ? '∞' : limits.maxEvents}`
        },
        guests: {
            current: counts.guests || 0,
            limit: limits.maxGuestsPerEvent,
            display: `${counts.guests || 0}/${limits.maxGuestsPerEvent === Infinity ? '∞' : limits.maxGuestsPerEvent}`
        },
        staffRoster: {
            current: counts.staffRoster || 0,
            limit: limits.maxStaffRoster,
            display: `${counts.staffRoster || 0}/${limits.maxStaffRoster === Infinity ? '∞' : limits.maxStaffRoster}`
        },
        expenses: {
            current: counts.expenses || 0,
            limit: limits.maxExpenses,
            display: `${counts.expenses || 0}/${limits.maxExpenses === Infinity ? '∞' : limits.maxExpenses}`
        },
        suppliers: {
            current: counts.suppliers || 0,
            limit: limits.maxSuppliers,
            display: `${counts.suppliers || 0}/${limits.maxSuppliers === Infinity ? '∞' : limits.maxSuppliers}`
        },
        plan: plan,
        aiFeatures: limits.aiFeatures
    };
};
