import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface GoogleCallbackProps {
    onLogin: (id: string, name: string, email: string, role?: string, permissions?: any, eventId?: string, plan?: string) => void;
}

const GoogleCallbackScreen: React.FC<GoogleCallbackProps> = ({ onLogin }) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const hasProcessed = useRef(false);

    useEffect(() => {
        // Prevent multiple executions
        if (hasProcessed.current) {
            return;
        }

        let googleAuth = searchParams.get('googleAuth');
        let userData = searchParams.get('user');
        let error = searchParams.get('error');

        // Fallback for HashRouter edge cases if params are before the hash
        if (!googleAuth && !error) {
            let paramsSource = window.location.search;
            if (window.location.hash.includes('?')) {
                paramsSource = window.location.hash.substring(window.location.hash.indexOf('?'));
            }
            const fallbackParams = new URLSearchParams(paramsSource);
            googleAuth = googleAuth || fallbackParams.get('googleAuth');
            userData = userData || fallbackParams.get('user');
            error = error || fallbackParams.get('error');
        }

        if (error) {
            console.error('[GOOGLE AUTH] Error:', error, searchParams.get('message'));
            hasProcessed.current = true;
            navigate('/login', { replace: true });
            return;
        }

        if (googleAuth === 'success' && userData) {
            try {
                const parsed = JSON.parse(decodeURIComponent(userData));
                console.log('[GOOGLE AUTH] Login successful:', parsed.email);

                hasProcessed.current = true;

                // Call onLogin with parsed user data
                onLogin(
                    parsed.id,
                    parsed.name,
                    parsed.email,
                    parsed.role || 'subscriber',
                    {}, // permissions
                    undefined, // eventId
                    parsed.plan || 'freemium'
                );

                // Redirect to dashboard with replace to prevent back navigation
                navigate('/dashboard', { replace: true });
            } catch (e) {
                console.error('[GOOGLE AUTH] Failed to parse user data:', e);
                hasProcessed.current = true;
                navigate('/login', { replace: true });
            }
        } else {
            hasProcessed.current = true;
            navigate('/login', { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]); // Intentionally excluding onLogin and navigate to prevent re-runs

    return (
        <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">Iniciando sesión con Google...</p>
            </div>
        </div>
    );
};

export default GoogleCallbackScreen;
