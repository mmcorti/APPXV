import nodemailer from 'nodemailer';

export const sendRecoveryEmail = async (toEmail, recoveryLink) => {
    try {
        const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
        const smtpPort = parseInt(process.env.SMTP_PORT, 10) || 465;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;

        if (!smtpUser || !smtpPass) {
            console.warn('⚠️ SMTP credentials are not configured. Cannot send recovery email. Logged recovery link instead:', recoveryLink);
            return false;
        }

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465, // true for 465, false for other ports
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
                <h2 style="color: #4F46E5; text-align: center;">Recuperación de Contraseña</h2>
                <p style="color: #333; font-size: 16px;">Has solicitado restablecer tu contraseña en <strong>APPXV</strong>.</p>
                <p style="color: #333; font-size: 16px;">Haz clic en el siguiente botón para crear una nueva contraseña:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${recoveryLink}" style="background-color: #4F46E5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
                        Restablecer Contraseña
                    </a>
                </div>
                <p style="color: #666; font-size: 14px; text-align: center;">
                    Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                    <a href="${recoveryLink}" style="color: #4F46E5; word-break: break-all;">${recoveryLink}</a>
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="color: #999; font-size: 12px; text-align: center;">
                    Si no has solicitado este correo, puedes ignorarlo de forma segura.
                </p>
            </div>
        `;

        const mailOptions = {
            from: `"APPXV Soporte" <${smtpUser}>`,
            to: toEmail,
            subject: 'Recuperar Contraseña - APPXV',
            html: htmlContent,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Recovery email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error sending recovery email:', error);
        throw error;
    }
};
