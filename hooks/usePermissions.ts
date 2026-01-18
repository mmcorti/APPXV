import { User, StaffPermissions } from '../types';

interface UsePermissionsReturn {
    isAdmin: boolean;
    isStaff: boolean;
    can: (permission: keyof StaffPermissions) => boolean;
    canAccessEvent: (eventId: string) => boolean;
}

export const usePermissions = (user: User | null): UsePermissionsReturn => {
    const isAdmin = user?.role === 'admin';
    const isStaff = user?.role === 'staff';

    const can = (permission: keyof StaffPermissions): boolean => {
        if (!user) return false;
        if (isAdmin) return true;
        return user.permissions?.[permission] || false;
    };

    const canAccessEvent = (eventId: string): boolean => {
        if (!user) return false;
        if (isAdmin) return true;
        // Staff can only access their assigned event
        return user.eventId === eventId;
    };

    return { isAdmin, isStaff, can, canAccessEvent };
};

export default usePermissions;
