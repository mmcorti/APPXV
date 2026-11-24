const ALLOWED_GOOGLE_PHOTOS_HOSTS = new Set([
    'photos.app.goo.gl',
    'photos.google.com',
]);

const PRIVATE_IP_PATTERNS = [
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^::1$/,
    /^fc/i,
    /^fd/i,
    /^fe80:/i,
];

function isBlockedHostname(hostname) {
    const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (!h) return true;
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h === 'metadata.google.internal') {
        return true;
    }
    return PRIVATE_IP_PATTERNS.some((rx) => rx.test(h));
}

export function assertSafeGooglePhotosUrl(rawUrl, allowGoogleUserContent = false) {
    let parsed;
    try {
        parsed = new URL(String(rawUrl || '').trim());
    } catch {
        throw new Error('URL de álbum inválida');
    }

    if (parsed.protocol !== 'https:') {
        throw new Error('La URL de Google Photos debe usar HTTPS');
    }

    const host = parsed.hostname.toLowerCase();
    const isAllowed =
        ALLOWED_GOOGLE_PHOTOS_HOSTS.has(host) ||
        (allowGoogleUserContent && (host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com')));

    if (!isAllowed) {
        throw new Error('Solo se permiten enlaces oficiales de Google Photos (photos.app.goo.gl o photos.google.com)');
    }

    return parsed.toString();
}

export function assertSafeExternalImageUrl(rawUrl) {
    const str = String(rawUrl || '').trim();
    if (str.startsWith('data:image/')) return str;

    let parsed;
    try {
        parsed = new URL(str);
    } catch {
        throw new Error('URL de imagen inválida');
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('Protocolo de URL no permitido');
    }

    if (isBlockedHostname(parsed.hostname)) {
        throw new Error('Destino de URL no permitido');
    }

    return parsed.toString();
}

export function sanitizeFrontendRedirect(candidateUrl) {
    const defaultFrontend = (process.env.FRONTEND_URL || 'https://appxv-246238664786.southamerica-east1.run.app').replace(/\/+$/, '');
    const allowedOrigins = new Set([
        'https://appxv-246238664786.southamerica-east1.run.app',
        'https://appxv.madiba.com.ar',
        'http://localhost:5173',
        'http://localhost:3000',
    ]);

    try {
        allowedOrigins.add(new URL(defaultFrontend).origin);
    } catch {
        // ignore invalid env
    }

    if (!candidateUrl || typeof candidateUrl !== 'string') {
        return defaultFrontend;
    }

    try {
        const parsed = new URL(candidateUrl);
        if (allowedOrigins.has(parsed.origin)) {
            return parsed.origin;
        }
    } catch {
        // invalid URL
    }

    return defaultFrontend;
}
