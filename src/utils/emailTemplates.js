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

/**
 * Shared base styles for transaction email templates.
 * Keeps the CollabDen brand consistent across all emails.
 */
const getTransactionEmailStyles = () => `
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
    color: white;
    padding: 40px 20px;
    text-align: center;
  }
  .header h1 {
    margin: 0 0 6px 0;
    font-size: 26px;
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
    margin-top: 0;
    font-size: 20px;
    font-weight: 600;
  }
  .amount-box {
    text-align: center;
    margin: 28px 0;
    padding: 24px;
    border-radius: 12px;
  }
  .amount-label {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  }
  .amount-value {
    font-size: 36px;
    font-weight: 800;
    letter-spacing: -1px;
  }
  .details-table {
    width: 100%;
    border-collapse: collapse;
    margin: 24px 0;
  }
  .details-table td {
    padding: 10px 0;
    font-size: 14px;
    border-bottom: 1px solid #f0f0f0;
  }
  .details-table td:first-child {
    color: #888;
    width: 40%;
  }
  .details-table td:last-child {
    font-weight: 600;
    text-align: right;
    color: #333;
  }
  .status-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .info-box {
    border-radius: 8px;
    padding: 14px 16px;
    font-size: 13px;
    margin: 20px 0;
  }
  .divider {
    height: 1px;
    background: linear-gradient(to right, transparent, #e0e0e0, transparent);
    margin: 30px 0;
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
`;

/**
 * Wallet Funding Success email template.
 *
 * @param {object} data
 * @param {number} data.amount - Credited amount
 * @param {number} data.newBalance - Updated wallet balance
 * @param {string} data.reference - Transaction reference
 * @returns {{ html: string, text: string }}
 */
const getWalletFundedEmailTemplate = ({ amount, newBalance, reference }) => {
  const formattedAmount = Number(amount).toLocaleString();
  const formattedBalance = Number(newBalance).toLocaleString();
  const date = new Date().toLocaleDateString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>${getTransactionEmailStyles()}</style>
      </head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #204f99 0%, #73bf44 100%);">
            <h1>Wallet Funded ✅</h1>
            <p>Your CollabDen wallet has been credited</p>
          </div>
          
          <div class="content">
            <h2 style="color: #204f99;">Credit Alert</h2>
            
            <p>Hi there,</p>
            <p>Your wallet has been successfully funded. Here are the details:</p>
            
            <div class="amount-box" style="background: linear-gradient(135deg, #eef3fc 0%, #f2fae8 100%); border: 2px solid #73bf44;">
              <div class="amount-label" style="color: #888;">Amount Credited</div>
              <div class="amount-value" style="color: #204f99;">₦${formattedAmount}</div>
            </div>
            
            <table class="details-table">
              <tr>
                <td>Transaction Type</td>
                <td>Wallet Funding</td>
              </tr>
              <tr>
                <td>Reference</td>
                <td>${reference}</td>
              </tr>
              <tr>
                <td>Date</td>
                <td>${date}</td>
              </tr>
              <tr>
                <td>Status</td>
                <td><span class="status-badge" style="background-color: #e8f5e9; color: #2e7d32;">Completed</span></td>
              </tr>
              <tr>
                <td>New Balance</td>
                <td style="color: #2e7d32; font-size: 16px;">₦${formattedBalance}</td>
              </tr>
            </table>
            
            <div class="divider"></div>
            
            <div class="info-box" style="background-color: #f0f4f8; color: #666;">
              <span style="color: #204f99; font-weight: 600;">🔒 Security Tip:</span> If you did not perform this transaction, please contact our support team immediately.
            </div>
            
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

  const textContent = `Wallet Funded — ₦${formattedAmount} has been credited to your CollabDen wallet. New balance: ₦${formattedBalance}. Reference: ${reference}. Date: ${date}.`;

  return { html: htmlContent, text: textContent };
};

/**
 * Withdrawal Initiated email template.
 *
 * @param {object} data
 * @param {number} data.amount - Withdrawal amount
 * @param {string} data.bankName - Destination bank name
 * @param {string} data.accountNumber - Destination account (masked)
 * @param {string} data.reference - Transaction reference
 * @returns {{ html: string, text: string }}
 */
const getWithdrawalInitiatedEmailTemplate = ({ amount, bankName, accountNumber, reference }) => {
  const formattedAmount = Number(amount).toLocaleString();
  const maskedAccount = `****${accountNumber.slice(-4)}`;
  const date = new Date().toLocaleDateString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>${getTransactionEmailStyles()}</style>
      </head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #204f99 0%, #f6a623 100%);">
            <h1>Withdrawal Processing ⏳</h1>
            <p>Your withdrawal request has been submitted</p>
          </div>
          
          <div class="content">
            <h2 style="color: #204f99;">Debit Alert</h2>
            
            <p>Hi there,</p>
            <p>Your withdrawal request has been submitted and is being processed. Here are the details:</p>
            
            <div class="amount-box" style="background: linear-gradient(135deg, #fff8ec 0%, #fff3e0 100%); border: 2px solid #f6a623;">
              <div class="amount-label" style="color: #888;">Amount</div>
              <div class="amount-value" style="color: #e65100;">₦${formattedAmount}</div>
            </div>
            
            <table class="details-table">
              <tr>
                <td>Transaction Type</td>
                <td>Withdrawal</td>
              </tr>
              <tr>
                <td>Destination Bank</td>
                <td>${bankName}</td>
              </tr>
              <tr>
                <td>Account Number</td>
                <td>${maskedAccount}</td>
              </tr>
              <tr>
                <td>Reference</td>
                <td>${reference}</td>
              </tr>
              <tr>
                <td>Date</td>
                <td>${date}</td>
              </tr>
              <tr>
                <td>Status</td>
                <td><span class="status-badge" style="background-color: #fff3e0; color: #e65100;">Processing</span></td>
              </tr>
            </table>
            
            <div class="info-box" style="background-color: #fffbf0; border-left: 4px solid #f6a623; border-radius: 4px;">
              ⏱ Withdrawals typically take <strong>a few minutes to a few hours</strong> to complete. You'll receive another email once the transfer is confirmed.
            </div>
            
            <div class="divider"></div>
            
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

  const textContent = `Withdrawal Processing — ₦${formattedAmount} withdrawal to ${bankName} (${maskedAccount}) is being processed. Reference: ${reference}. Date: ${date}.`;

  return { html: htmlContent, text: textContent };
};

/**
 * Withdrawal Completed email template.
 *
 * @param {object} data
 * @param {number} data.amount - Withdrawal amount
 * @param {string} data.reference - Transaction reference
 * @returns {{ html: string, text: string }}
 */
const getWithdrawalCompletedEmailTemplate = ({ amount, reference }) => {
  const formattedAmount = Number(amount).toLocaleString();
  const date = new Date().toLocaleDateString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>${getTransactionEmailStyles()}</style>
      </head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #204f99 0%, #73bf44 100%);">
            <h1>Withdrawal Successful ✅</h1>
            <p>Your funds have been transferred</p>
          </div>
          
          <div class="content">
            <h2 style="color: #2e7d32;">Transfer Complete</h2>
            
            <p>Hi there,</p>
            <p>Great news! Your withdrawal has been processed and the funds have been sent to your bank account.</p>
            
            <div class="amount-box" style="background: linear-gradient(135deg, #e8f5e9 0%, #f2fae8 100%); border: 2px solid #73bf44;">
              <div class="amount-label" style="color: #888;">Amount Transferred</div>
              <div class="amount-value" style="color: #2e7d32;">₦${formattedAmount}</div>
            </div>
            
            <table class="details-table">
              <tr>
                <td>Transaction Type</td>
                <td>Withdrawal</td>
              </tr>
              <tr>
                <td>Reference</td>
                <td>${reference}</td>
              </tr>
              <tr>
                <td>Date</td>
                <td>${date}</td>
              </tr>
              <tr>
                <td>Status</td>
                <td><span class="status-badge" style="background-color: #e8f5e9; color: #2e7d32;">Completed</span></td>
              </tr>
            </table>
            
            <div class="info-box" style="background-color: #e8f5e9; color: #2e7d32;">
              ✅ The funds should reflect in your bank account shortly. If you don't see it within 24 hours, please contact support.
            </div>
            
            <div class="divider"></div>
            
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

  const textContent = `Withdrawal Completed — ₦${formattedAmount} has been successfully transferred to your bank account. Reference: ${reference}. Date: ${date}.`;

  return { html: htmlContent, text: textContent };
};

/**
 * Withdrawal Failed email template.
 *
 * @param {object} data
 * @param {number} data.amount - Withdrawal amount
 * @param {string} data.reference - Transaction reference
 * @param {string} [data.reason] - Failure reason
 * @returns {{ html: string, text: string }}
 */
const getWithdrawalFailedEmailTemplate = ({ amount, reference, reason }) => {
  const formattedAmount = Number(amount).toLocaleString();
  const failureReason = reason || "The payout could not be processed by the bank.";
  const date = new Date().toLocaleDateString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>${getTransactionEmailStyles()}</style>
      </head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #c62828 0%, #e53935 100%);">
            <h1>Withdrawal Failed ❌</h1>
            <p>Your withdrawal could not be processed</p>
          </div>
          
          <div class="content">
            <h2 style="color: #c62828;">Transaction Failed</h2>
            
            <p>Hi there,</p>
            <p>Unfortunately, your withdrawal request could not be completed. The funds have been <strong>returned to your wallet</strong>.</p>
            
            <div class="amount-box" style="background: linear-gradient(135deg, #ffebee 0%, #fce4ec 100%); border: 2px solid #e53935;">
              <div class="amount-label" style="color: #888;">Amount Reversed</div>
              <div class="amount-value" style="color: #c62828;">₦${formattedAmount}</div>
            </div>
            
            <table class="details-table">
              <tr>
                <td>Transaction Type</td>
                <td>Withdrawal</td>
              </tr>
              <tr>
                <td>Reference</td>
                <td>${reference}</td>
              </tr>
              <tr>
                <td>Date</td>
                <td>${date}</td>
              </tr>
              <tr>
                <td>Status</td>
                <td><span class="status-badge" style="background-color: #ffebee; color: #c62828;">Failed</span></td>
              </tr>
              <tr>
                <td>Reason</td>
                <td style="color: #c62828;">${failureReason}</td>
              </tr>
            </table>
            
            <div class="info-box" style="background-color: #e8f5e9; border-left: 4px solid #73bf44; border-radius: 4px; color: #333;">
              💰 <strong>Don't worry!</strong> The full amount of ₦${formattedAmount} has been reversed and is back in your wallet. You can try again or contact support if this persists.
            </div>
            
            <div class="divider"></div>
            
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

  const textContent = `Withdrawal Failed — Your withdrawal of ₦${formattedAmount} could not be processed. Reason: ${failureReason}. The funds have been returned to your wallet. Reference: ${reference}. Date: ${date}.`;

  return { html: htmlContent, text: textContent };
};

module.exports = {
  getVerificationEmailTemplate,
  getPasswordResetEmailTemplate,
  getWalletFundedEmailTemplate,
  getWithdrawalInitiatedEmailTemplate,
  getWithdrawalCompletedEmailTemplate,
  getWithdrawalFailedEmailTemplate,
};
