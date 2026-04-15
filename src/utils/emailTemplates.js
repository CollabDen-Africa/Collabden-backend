const getVerificationEmailTemplate = (verificationToken) => {
  const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_APP_URL;
  const verificationLink = `${frontendUrl}/verify?token=${verificationToken}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
              <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f0f4f8;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #204f99 0%, #73bf44 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0 0 6px 0;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          .header p {
            margin: 0;
            font-size: 14px;
            opacity: 0.85;
          }
          .content {
            padding: 40px 30px;
            color: #333333;
          }
          .content h2 {
            color: #204f99;
            margin-top: 0;
            font-size: 20px;
            font-weight: 600;
          }
          .otp-container {
            text-align: center;
            margin: 30px 0;
          }
          .otp-label {
            font-size: 13px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
          }
          .otp-code {
            display: inline-block;
            background: linear-gradient(135deg, #eef3fc 0%, #f2fae8 100%);
            border: 2px dashed #73bf44;
            border-radius: 12px;
            padding: 18px 44px;
            font-size: 40px;
            font-weight: 800;
            letter-spacing: 12px;
            color: #204f99;
          }
          .expiry-note {
            background-color: #fffbf0;
            border-left: 4px solid #f6a623;
            padding: 12px 15px;
            margin: 24px 0;
            border-radius: 4px;
            font-size: 14px;
            color: #555;
          }
          .security-note {
            background-color: #f0f4f8;
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 13px;
            color: #666;
            margin: 20px 0;
          }
          .security-note span {
            color: #204f99;
            font-weight: 600;
          }
          .footer {
            background: linear-gradient(135deg, #204f99 0%, #1a3f7a 100%);
            padding: 24px 20px;
            text-align: center;
            color: rgba(255,255,255,0.75);
            font-size: 12px;
          }
          .footer a {
            color: #73bf44;
            text-decoration: none;
            font-weight: 600;
          }
          .divider {
            height: 1px;
            background: linear-gradient(to right, transparent, #e0e0e0, transparent);
            margin: 30px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to CollabDen!</h1>
          </div>
          
          <div class="content">
            <h2>Account Creation Successful</h2>
            
            <p>Hi there,</p>
            
            <p>Thank you for signing up with CollabDen! We're excited to have you on board.</p>
            
            <div class="success-message">
              <p style="margin: 0;"><strong> Your account has been created successfully!</strong></p>
            </div>
            
            <p>Thanks for signing up! Enter the code below in the app to confirm your email address and activate your account.</p>
            
          <div class="otp-container">
              <div class="otp-label">Your verification code</div>
              <div class="otp-code">${verificationToken}</div>
            </div>
            <div class="expiry-note">
              ⏱ This code expires in <strong>15 minutes</strong>.
            </div>
            
            <div class="divider"></div>
            
            <p>If you didn't create this account, you can safely ignore this email.</p>
            
            <p>
              Best regards,<br>
              <strong>The CollabDen Team</strong>
            </p>
          </div>
          
          <div class="footer">
            <p style="margin: 0;">&copy; 2026 CollabDen. All rights reserved.</p>
            <p style="margin: 5px 0 0 0;">Need help? Contact us at support@collabden.com</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `Your CollabDen verification code is: ${verificationToken}\n\nThis code expires in 15 minutes.`;

  return {
    html: htmlContent,
    text: textContent,
  };
};

const getPasswordResetEmailTemplate = (resetToken) => {
  const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_APP_URL;
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
            color: #333333;
          }
          .content h2 {
            color: #667eea;
            margin-top: 0;
            font-size: 20px;
          }
          .warning-message {
            background-color: #fef3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .reset-button {
            display: inline-block;
            background-color: #667eea;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            margin: 30px 0;
            font-weight: 600;
            transition: background-color 0.3s;
          }
          .reset-button:hover {
            background-color: #5568d3;
          }
          .link-text {
            color: #666666;
            font-size: 12px;
            margin-top: 20px;
            word-break: break-all;
          }
          .footer {
            background-color: #f8f8f8;
            padding: 20px;
            text-align: center;
            color: #666666;
            font-size: 12px;
            border-top: 1px solid #e0e0e0;
          }
          .divider {
            height: 1px;
            background-color: #e0e0e0;
            margin: 30px 0;
          }
          .expiry-warning {
            color: #dc3545;
            font-size: 12px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request 🔐</h1>
          </div>
          
          <div class="content">
            <h2>Reset Your Password</h2>
            
            <p>Hi there,</p>
            
            <p>We received a request to reset your CollabDen password. Click the button below to create a new password:</p>
            
            <div class="warning-message">
              <p style="margin: 0;"><strong>⚠️ This link expires in 1 hour for security purposes.</strong></p>
            </div>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="reset-button">Reset Password</a>
            </div>
            
            <p style="color: #666666; font-size: 14px;">If the button above doesn't work, you can also copy and paste this link into your browser:</p>
            <p class="link-text">${resetLink}</p>
            
            <div class="divider"></div>
            
            <p><strong style="color: #dc3545;">Didn't request a password reset?</strong></p>
            <p>If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            
            <p>
              Best regards,<br>
              <strong>The CollabDen Team</strong>
            </p>
          </div>
          
          <div class="footer">
            <p style="margin: 0;">&copy; 2026 CollabDen. All rights reserved.</p>
            <p style="margin: 5px 0 0 0;">Need help? Contact us at support@collabden.com</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `Password Reset Request - Reset your password by visiting: ${resetLink} (This link expires in 1 hour)`;

  return {
    html: htmlContent,
    text: textContent,
  };
};

module.exports = {
  getVerificationEmailTemplate,
  getPasswordResetEmailTemplate,
};
