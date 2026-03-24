const getVerificationEmailTemplate = (verificationToken) => {
  const verificationLink = `${process.env.FRONTEND_URL}/verify?token=${verificationToken}`;

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
          .success-message {
            background-color: #f0f9ff;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .verify-button {
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
          .verify-button:hover {
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
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to CollabDen! 🎉</h1>
          </div>
          
          <div class="content">
            <h2>Account Creation Successful</h2>
            
            <p>Hi there,</p>
            
            <p>Thank you for signing up with CollabDen! We're excited to have you on board.</p>
            
            <div class="success-message">
              <p style="margin: 0;"><strong>✓ Your account has been created successfully!</strong></p>
            </div>
            
            <p>To get started and unlock all the features of CollabDen, please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center;">
              <a href="${verificationLink}" class="verify-button">Verify Email Address</a>
            </div>
            
            <p style="color: #666666; font-size: 14px;">If the button above doesn't work, you can also copy and paste this link into your browser:</p>
            <p class="link-text">${verificationLink}</p>
            
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

  const textContent = `Welcome to CollabDen! Please verify your email by visiting: ${verificationLink}`;

  return {
    html: htmlContent,
    text: textContent,
  };
};

module.exports = {
  getVerificationEmailTemplate,
};
