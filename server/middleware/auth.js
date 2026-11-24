import crypto from 'crypto';
import { supabase, TABLES } from '../supabase.js';

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function getSigningSecret() {
    const base = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_KEY || 'appxv-dev-fallback-secret';
    return crypto.createHash('sha256').update(`appxv-session:${base}`).digest();
}

function base64UrlEncode(input) {
    return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input) {
    return Buffer.from(input, 'base64url').toString('utf8');
}

export function signSessionToken({ id, email, role }) {
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const payload = base64UrlEncode(JSON.stringify({
        sub: String(id),
        email: String(email || '').toLowerCase(),
        role: role || 'subscriber',
        iat: now,
        exp: now + TOKEN_TTL_SECONDS
    }));
    const sig = crypto
        .createHmac('sha256', getSigningSecret())
        .update(`${header}.${payload}`)
        .digest('base64url');
    return `${header}.${payload}.${sig}`;
}

export function verifySessionToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, sig] = parts;
    const expectedSig = crypto
        .createHmac('sha256', getSigningSecret())
        .update(`${header}.${payload}`)
        .digest('base64url');

    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return null;
    }

    try {
        const decoded = JSON.parse(base64UrlDecode(payload));
        if (!decoded?.sub || !decoded?.exp) return null;
        if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
        return decoded;
    } catch {
        return null;
    }
}

export async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
        if (!token) {
            return res.status(401).json({ error: 'Sesión requerida. Volvé a iniciar sesión.' });
        }

        const decoded = verifySessionToken(token);
        if (!decoded) {
            return res.status(401).json({ error: 'Sesión inválida o expirada. Volvé a iniciar sesión.' });
        }

        const { data: user, error } = await supabase
            .from(TABLES.USERS)
            .select('id, email, role, plan, username')
            .eq('id', decoded.sub)
            .maybeSingle();

        if (error || !user) {
            return res.status(401).json({ error: 'Usuario no válido.' });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error('[AUTH] Middleware error:', err.message);
        res.status(500).json({ error: 'Error de autenticación' });
    }
}

export function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado: requiere permisos de administrador.' });
        }
        next();
    });
}
