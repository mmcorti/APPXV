import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface GoogleCallbackProps {
    onLogin: (id: string, name: string, email: string, role?: string, permissions?: any, eventId?: string, plan?: string) => void;
}

const GoogleCallbackScreen: React.FC<GoogleCallbackProps> = ({ onLogin }) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const googleAuth = searchParams.get('googleAuth');
        const userData = searchParams.get('user');
        const error = searchParams.get('error');

        if (error) {
            console.error('[GOOGLE AUTH] Error:', error, searchParams.get('message'));
            navigate('/login');
            return;
        }

        if (googleAuth === 'success' && userData) {
            try {
                const parsed = JSON.parse(decodeURIComponent(userData));
                console.log('[GOOGLE AUTH] Login successful:', parsed.email);

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

                // Redirect to dashboard
                navigate('/dashboard');
            } catch (e) {
                console.error('[GOOGLE AUTH] Failed to parse user data:', e);
                navigate('/login');
            }
        } else {
            navigate('/login');
        }
    }, [searchParams, onLogin, navigate]);

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
