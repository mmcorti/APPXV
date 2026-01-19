/**
 * Plan Limits Configuration
 * Defines subscription plan limits for different user tiers
 */

// Plan configuration constants
export const PLAN_LIMITS = {
    freemium: {
        maxEvents: 1,
        maxGuestsPerEvent: 50,
        maxSubscribers: 0, // Only ADMIN can create subscribers
        maxStaffRoster: 3,
        maxPhotosPerEvent: 20,
        aiFeatures: false
    },
    premium: {
        maxEvents: 5,
        maxGuestsPerEvent: 200,
        maxSubscribers: 0, // Only ADMIN can create subscribers
        maxStaffRoster: 20,
        maxPhotosPerEvent: 200,
        aiFeatures: true
    },
    vip: {
        maxEvents: Infinity,
        maxGuestsPerEvent: Infinity,
        maxSubscribers: 0, // Only ADMIN can create subscribers
        maxStaffRoster: Infinity,
        maxPhotosPerEvent: 1000,
        aiFeatures: true
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
        plan: plan,
        aiFeatures: limits.aiFeatures
    };
};
