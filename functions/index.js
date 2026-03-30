const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

admin.initializeApp();

// Initialize SendGrid with API key
// IMPORTANT: Set this via Firebase CLI before deploying functions:
// firebase functions:config:set sendgrid.key="YOUR_SENDGRID_KEY"
const SENDGRID_API_KEY = functions.config().sendgrid ? functions.config().sendgrid.key : 'YOUR_SENDGRID_API_KEY_HERE';
sgMail.setApiKey(SENDGRID_API_KEY);

/**
 * Cloud Function to send invite emails via SendGrid Web API
 * Called from the Admin Panel when onboarding parents
 */
exports.sendInviteEmail = functions.https.onCall(async (data, context) => {
    // Verify the user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in to send emails');
    }

    const { to, subject, html, schoolId } = data;

    if (!to || !subject) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: to, subject');
    }

    // Fetch school name from Firestore
    let schoolName = 'Your School';
    console.log('📧 Received schoolId:', schoolId);
    if (schoolId) {
        try {
            const schoolDoc = await admin.firestore().collection('schools').doc(schoolId).get();
            console.log('📧 School doc exists:', schoolDoc.exists);
            if (schoolDoc.exists && schoolDoc.data().name) {
                schoolName = schoolDoc.data().name;
                console.log('📧 Found school name:', schoolName);
            }
        } catch (err) {
            console.warn('Could not fetch school name:', err.message);
        }
    }

    // Replace placeholder in HTML template
    console.log('📧 HTML contains ${schoolName}:', html.includes('${schoolName}'));
    const finalHtml = html.replace(/\$\{schoolName\}/g, schoolName);

    const msg = {
        to: to,
        from: 'SurePickup <admin@cdsspickup.com.ng>', // Branded Sender
        replyTo: 'admin@cdsspickup.com.ng',
        subject: subject,
        html: finalHtml,
        // Disable link tracking to prevent broken redirect URLs
        trackingSettings: {
            clickTracking: {
                enable: false,
                enableText: false
            }
        }
    };

    try {
        await sgMail.send(msg);
        console.log('✅ Email sent successfully to:', to);
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to send email:', error);
        if (error.response) {
            console.error('SendGrid Response:', error.response.body);
        }
        throw new functions.https.HttpsError('internal', 'Failed to send email via SendGrid');
    }
});

/**
 * Cloud Function to send branded password reset emails
 * Called from Login page "Forgot Password"
 */
exports.sendPasswordReset = functions.https.onCall(async (data, context) => {
    const { email } = data;

    if (!email) {
        throw new functions.https.HttpsError('invalid-argument', 'Email is required');
    }

    try {
        console.log(`🔐 Password reset requested for: ${email}`);

        // 1. Find user by email
        const userRecord = await admin.auth().getUserByEmail(email);
        const uid = userRecord.uid;

        // 2. Generate reset link (Firebase Auth native link)
        const link = await admin.auth().generatePasswordResetLink(email);

        // 3. Get user role & school info for branding
        let role = 'user';
        let schoolName = 'SurePickup';
        let displayName = userRecord.displayName || 'User';

        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            role = userData.role || 'user';
            displayName = userData.displayName || displayName;

            if (userData.schoolId) {
                const schoolDoc = await admin.firestore().collection('schools').doc(userData.schoolId).get();
                if (schoolDoc.exists) schoolName = schoolDoc.data().name || schoolName;
            }
        }

        // 4. Construct Custom Email Content based on Role
        let subject = `Password Reset - ${schoolName}`;
        let htmlContent = '';

        const commonStyle = `font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;`;
        const btnStyle = `display: inline-block; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px; color: white;`;

        if (role === 'parent') {
            htmlContent = `
                <div style="${commonStyle}">
                    <h2 style="color: #3D5A5B; margin-top: 0;">Reset Your Password</h2>
                    <p style="font-size: 16px; color: #333;">Dear ${displayName},</p>
                    <p style="font-size: 16px; color: #555;">We received a request to reset the password for your parent account at <strong>${schoolName}</strong>.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${link}" style="${btnStyle} background-color: #E07A5F;">Reset My Password</a>
                    </div>
                    <p style="font-size: 14px; color: #777;">If you didn't ask for this, you can safely ignore this email.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #999;">Sent by SurePickup System</p>
                </div>
            `;
        } else if (['teacher', 'admin', 'superAdmin'].includes(role)) {
            htmlContent = `
                <div style="${commonStyle}">
                    <h2 style="color: #2B2D42; margin-top: 0;">System Access Recovery</h2>
                    <p style="font-size: 16px; color: #333;">Hello ${displayName},</p>
                    <p style="font-size: 16px; color: #555;">A password reset was initiated for your <strong>${role}</strong> account at <strong>${schoolName}</strong>.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${link}" style="${btnStyle} background-color: #3D5A5B;">Secure Password Reset</a>
                    </div>
                    <p style="font-size: 14px; color: #777;">This link is valid for 1 hour. If this wasn't you, please contact your Super Admin immediately.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #999;">Sent by SurePickup Security</p>
                </div>
            `;
        } else {
            // Fallback
            htmlContent = `
                <div style="${commonStyle}">
                    <h2>Reset Password</h2>
                    <p>Click the link below to reset your password:</p>
                    <p><a href="${link}">${link}</a></p>
                </div>
            `;
        }

        // 5. Send with SendGrid
        const msg = {
            to: email,
            from: 'SurePickup <admin@cdsspickup.com.ng>',
            subject: subject,
            html: htmlContent,
            trackingSettings: {
                clickTracking: {
                    enable: false,
                    enableText: false
                }
            }
        };

        await sgMail.send(msg);
        console.log(`✅ Password reset email sent to ${email}`);
        return { success: true };

    } catch (error) {
        console.error('Error sending password reset:', error);

        // If user not found, we shouldn't reveal it for security, but returning success is standard
        if (error.code === 'auth/user-not-found') {
            console.warn(`User ${email} not found, suppressing error.`);
            return { success: true };
        }

        throw new functions.https.HttpsError('internal', 'Unable to send reset email');
    }
});
