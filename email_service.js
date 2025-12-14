const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // e.g. 'your-email@gmail.com'
        pass: process.env.EMAIL_PASS  // App Password from Google
    }
});

async function sendInviteEmail(toEmail, inviteCode, name, role) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️  Email credentials not set. Skipping email send.');
        return false;
    }

    // Format name as Mr./Mrs. LastName
    const lastName = name ? name.split(' ').pop() : 'Parent';
    const title = role === 'Mother' ? 'Mrs.' : 'Mr.';
    const formalName = `${title} ${lastName}`;

    const mailOptions = {
        from: `"CDSS Parent Pickup Portal" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `Welcome to the ${role || 'Parent'} Portal`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #4f46e5;">Welcome ${formalName},</h2>
                <p>You have been invited to join the <strong>Student Pickup System</strong>.</p>
                <p>Please use the following Onboarding Code to create your account:</p>
                
                <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
                    <span style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #1f2937;">${inviteCode}</span>
                </div>
                
                <p><strong>Steps to join:</strong></p>
                <ol>
                    <li>Go to the Parent Portal.</li>
                    <li>Enter the code above.</li>
                    <li>Create your username and password.</li>
                </ol>
                
                <p style="color: #666; font-size: 12px; margin-top: 30px;">This code is valid for 7 days.</p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent: ' + info.response);
        return true;
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return false;
    }
}

module.exports = {
    sendInviteEmail
};
