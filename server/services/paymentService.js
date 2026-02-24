import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

const PLAN_DETAILS = {
    especial: {
        title: 'Plan Especial - APPXV',
        price: 25,
        description: 'Suscripción Plan Especial (5 eventos, 100 invitados)'
    },
    vip: {
        title: 'Plan VIP - APPXV',
        price: 75,
        description: 'Suscripción Plan VIP (20 eventos, 200 invitados)'
    }
};

/**
 * Creates a MercadoPago Preference (Checkout Pro)
 * @param {string} planId 'especial' or 'vip'
 * @param {string} userEmail User's email
 * @param {string} userId User's UUID from Supabase
 * @returns {Promise<Object>} The init_point and preference ID
 */
export const createPaymentPreference = async (planId, userEmail, userId, requestBaseUrl = '') => {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
        console.warn('[PaymentService] Warning: MP_ACCESS_TOKEN not configured. Returning dummy URL for testing.');
        return {
            id: 'dummy_pref_id',
            init_point: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=dummy',
            sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=dummy'
        };
    }

    const plan = PLAN_DETAILS[planId.toLowerCase()];
    if (!plan) {
        throw new Error('Invalid plan ID');
    }

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    // GCloud/Render dynamically resolve the frontend URL based on the incoming request.
    // Fallback to explicit FRONTEND_URL, or hardcoded Render URL for safety.
    let baseUrl = requestBaseUrl || process.env.FRONTEND_URL || 'https://appxv.onrender.com';
    baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash if any

    // Ensure it's not http://localhost if MP blocks it for your account
    if (baseUrl.includes('localhost')) {
        console.warn('[PaymentService] Localhost detected for baseUrl, some MP accounts block localhost auto_return urls.');
    }

    const webhookUrl = process.env.MP_WEBHOOK_URL || `${baseUrl}/api/payments/webhook`;

    try {
        console.log(`[PaymentService] Creating preference for user ${userEmail}, plan ${planId}`);
        const response = await preference.create({
            body: {
                items: [
                    {
                        id: planId,
                        title: plan.title,
                        description: plan.description,
                        quantity: 1,
                        unit_price: plan.price,
                        currency_id: 'ARS'
                    }
                ],
                payer: {
                    email: userEmail
                },
                back_urls: {
                    success: `${baseUrl}/payment/success`,
                    failure: `${baseUrl}/payment/failure`,
                    pending: `${baseUrl}/payment/pending`
                },
                auto_return: 'approved',
                notification_url: webhookUrl,
                external_reference: userId,
                metadata: {
                    user_id: userId,
                    plan_id: planId
                }
            }
        });

        return {
            id: response.id,
            init_point: response.init_point,
            sandbox_init_point: response.sandbox_init_point
        };
    } catch (error) {
        console.error('[PaymentService] Error creating preference:', error);
        throw error;
    }
};

/**
 * Verifies a payment status coming from a Webhook notification
 * @param {string|number} paymentId The payment ID received in the webhook
 */
export const verifyPayment = async (paymentId) => {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
        console.warn('[PaymentService] MP_ACCESS_TOKEN not configured, mocking successful webhook check.');
        return { status: 'approved', external_reference: 'mock_user_id', metadata: { plan_id: 'especial', user_id: 'mock_user_id' } };
    }

    try {
        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);

        const paymentInfo = await payment.get({ id: paymentId });
        return paymentInfo;
    } catch (error) {
        console.error(`[PaymentService] Error verifying payment ${paymentId}:`, error);
        throw error;
    }
};
