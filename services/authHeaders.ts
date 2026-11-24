export function getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
    try {
        const saved = localStorage.getItem('appxv_user');
        const parsed = saved ? JSON.parse(saved) : null;
        if (parsed?.token) {
            return { ...extra, Authorization: `Bearer ${parsed.token}` };
        }
    } catch {
        // Ignore corrupted storage
    }
    return { ...extra };
}
