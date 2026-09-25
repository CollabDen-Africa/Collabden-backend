/**
 * Shared CollabDen email shell.
 *
 * Keep email-specific content in `content` and pass it here so every email has
 * the same neutral surface, slate borders, and CollabDen green accent.
 */
const getCollabDenEmailTemplate = ({
  headerTitle,
  headerSubtitle = "",
  content,
  preheader = headerSubtitle || headerTitle,
}) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background-color: #f3f5f7;
          margin: 0;
          padding: 24px 12px;
          color: #1f2937;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border: 1px solid #d9e0e8;
          border-radius: 20px;
          box-shadow: 0 12px 32px rgba(31,41,55,0.12);
          overflow: hidden;
        }
        .preheader { display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent; }
        .brand-bar { padding: 22px 30px 0; background-color: #ffffff; }
        .brand-mark {
          display: inline-block;
          background-color: #74c83d;
          border-radius: 10px;
          color: #ffffff;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -1px;
          line-height: 36px;
          text-align: center;
          width: 36px;
        }
        .brand-name { color: #1f2937; font-size: 20px; font-weight: 700; margin-left: 10px; vertical-align: middle; }
        .brand-tier { color: #6b7280; font-size: 12px; margin-left: 8px; vertical-align: middle; }
        .header {
          color: #1f2937;
          padding: 26px 30px 30px;
          background-color: #ffffff;
        }
        .header h1 {
          margin: 0 0 6px 0;
          font-size: 27px;
          font-weight: 700;
          letter-spacing: -0.7px;
        }
        .header p {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }
        .content {
          padding: 32px 30px;
          color: #4b5563;
        }
        .content h2 {
          margin-top: 0;
          font-size: 20px;
          font-weight: 600;
          color: #1f2937 !important;
        }
        .content p { line-height: 1.6; }
        .footer {
          padding: 22px 30px;
          text-align: center;
          background-color: #f8fafc;
          border-top: 1px solid #d9e0e8;
          color: #6b7280;
          font-size: 12px;
        }
        .footer a {
          color: #74c83d;
          text-decoration: none;
          font-weight: 600;
        }
        .divider {
          height: 1px;
          background: #d9e0e8;
          margin: 30px 0;
        }
        .amount-box {
          text-align: center;
          margin: 28px 0;
          padding: 24px;
          background: #f8fafc !important;
          border: 1px solid #d9e0e8 !important;
          border-radius: 14px;
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
          border-bottom: 1px solid #d9e0e8;
        }
        .details-table td:first-child {
          color: #6b7280;
          width: 40%;
        }
        .details-table td:last-child {
          font-weight: 600;
          text-align: right;
          color: #1f2937;
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
          background-color: #f8fafc !important;
          border: 1px solid #d9e0e8;
          border-radius: 10px;
          padding: 14px 16px;
          font-size: 13px;
          margin: 20px 0;
          color: #4b5563 !important;
        }
        .reset-button {
          display: inline-block;
          background-color: #74c83d;
          color: #132019;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 999px;
          margin: 30px 0;
          font-weight: 600;
          transition: background-color 0.3s;
        }
        .reset-button:hover {
          background-color: #8bd954;
        }
        .link-text {
          color: #6b7280;
          font-size: 12px;
          margin-top: 20px;
          word-break: break-all;
        }
        .otp-container {
          text-align: center;
          margin: 30px 0;
        }
        .otp-label {
          font-size: 13px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
        }
        .otp-code {
          display: inline-block;
          background: #f8fafc;
          border: 2px dashed #74c83d;
          border-radius: 12px;
          padding: 18px 44px;
          font-size: 40px;
          font-weight: 800;
          letter-spacing: 12px;
          color: #1f2937;
        }
        .expiry-note {
          background-color: #f8fafc;
          border-left: 4px solid #74c83d;
          padding: 12px 15px;
          margin: 24px 0;
          border-radius: 4px;
          font-size: 14px;
          color: #4b5563;
        }
        .success-message, .warning-message {
          background-color: #f8fafc;
          border-left: 4px solid #74c83d;
          border-radius: 8px;
          color: #4b5563;
          margin: 20px 0;
          padding: 14px 16px;
        }
        .warning-message { border-left-color: #f6a623; }
        @media only screen and (max-width: 620px) {
          body { padding: 0 !important; }
          .container { border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
          .brand-bar, .header, .content, .footer { padding-left: 20px !important; padding-right: 20px !important; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="preheader">${preheader}</div>
        <div class="brand-bar">
          <span class="brand-mark">CD</span><span class="brand-name">CollabDen</span><span class="brand-tier">Studio Pro</span>
        </div>
        <div class="header">
          <h1>${headerTitle}</h1>
          ${headerSubtitle ? `<p>${headerSubtitle}</p>` : ""}
        </div>
        
        <div class="content">
          ${content}
        </div>
        
        <div class="footer">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} CollabDen. All rights reserved.</p>
          <p style="margin: 5px 0 0 0;">Need help? Contact us at support@collabden.com</p>
        </div>
      </div>
    </body>
  </html>
`;

// Backward-compatible alias for existing template builders.
const getBaseEmailLayout = getCollabDenEmailTemplate;

const escapeHtml = (value) => String(value || "").replace(/[&<>"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
}[character]));

/**
 * Branded template for notification emails that need a single call to action.
 */
const getNotificationEmailTemplate = ({
  heading,
  message,
  actionLabel = "View notification",
  actionUrl,
}) => {
  const content = `
    <h2>${escapeHtml(heading)}</h2>
    <p>${escapeHtml(message)}</p>
    ${actionUrl ? `<div style="text-align: center;"><a href="${escapeHtml(actionUrl)}" class="reset-button">${escapeHtml(actionLabel)}</a></div>` : ""}
    <p style="color: #6b7280; font-size: 13px;">You can manage notification preferences from your CollabDen account.</p>
  `;

  return {
    html: getCollabDenEmailTemplate({
      headerTitle: heading,
      headerSubtitle: "CollabDen notification",
      content,
      preheader: message,
    }),
    text: `${heading}\n\n${message}${actionUrl ? `\n\n${actionLabel}: ${actionUrl}` : ""}`,
  };
};

const getVerificationEmailTemplate = (verificationToken) => {
  const content = `
    <h2 style="color: #204f99;">Account Creation Successful</h2>
    
    <p>Hi there,</p>
    
    <p>Thank you for signing up with CollabDen! We're excited to have you on board.</p>
    
    <div class="success-message">
      <p style="margin: 0;"><strong>Your account has been created successfully!</strong></p>
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
  `;

  return {
    html: getBaseEmailLayout({
      headerTitle: "Welcome to CollabDen!",
      content,
    }),
    text: `Your CollabDen verification code is: ${verificationToken}\n\nThis code expires in 15 minutes.`,
  };
};

const getPasswordResetEmailTemplate = (resetToken) => {
  const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_APP_URL;
  const resetLink = `${frontendUrl}/auth/new-password?token=${resetToken}`;

  const content = `
    <h2 style="color: #667eea;">Reset Your Password</h2>
    
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
  `;

  return {
    html: getBaseEmailLayout({
      headerTitle: "Password Reset Request 🔐",
      headerBackground: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      content,
    }),
    text: `Password Reset Request - Reset your password by visiting: ${resetLink} (This link expires in 1 hour)`,
  };
};

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

  const content = `
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
  `;

  return {
    html: getBaseEmailLayout({
      headerTitle: "Wallet Funded ✅",
      headerSubtitle: "Your CollabDen wallet has been credited",
      content,
    }),
    text: `Wallet Funded — ₦${formattedAmount} has been credited to your CollabDen wallet. New balance: ₦${formattedBalance}. Reference: ${reference}. Date: ${date}.`,
  };
};

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

  const content = `
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
  `;

  return {
    html: getBaseEmailLayout({
      headerTitle: "Withdrawal Processing ⏳",
      headerSubtitle: "Your withdrawal request has been submitted",
      headerBackground: "linear-gradient(135deg, #204f99 0%, #f6a623 100%)",
      content,
    }),
    text: `Withdrawal Processing — ₦${formattedAmount} withdrawal to ${bankName} (${maskedAccount}) is being processed. Reference: ${reference}. Date: ${date}.`,
  };
};

const getWithdrawalCompletedEmailTemplate = ({ amount, reference }) => {
  const formattedAmount = Number(amount).toLocaleString();
  const date = new Date().toLocaleDateString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const content = `
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
  `;

  return {
    html: getBaseEmailLayout({
      headerTitle: "Withdrawal Successful ✅",
      headerSubtitle: "Your funds have been transferred",
      content,
    }),
    text: `Withdrawal Completed — ₦${formattedAmount} has been successfully transferred to your bank account. Reference: ${reference}. Date: ${date}.`,
  };
};

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

  const content = `
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
  `;

  return {
    html: getBaseEmailLayout({
      headerTitle: "Withdrawal Failed ❌",
      headerSubtitle: "Your withdrawal could not be processed",
      headerBackground: "linear-gradient(135deg, #c62828 0%, #e53935 100%)",
      content,
    }),
    text: `Withdrawal Failed — Your withdrawal of ₦${formattedAmount} could not be processed. Reason: ${failureReason}. The funds have been returned to your wallet. Reference: ${reference}. Date: ${date}.`,
  };
};

const getAdmin2FAEmailTemplate = (code) => {
  const content = `
    <h2 style="color: #1a3f7a;">Login Attempt Detected</h2>
    
    <p>Hi Admin,</p>
    <p>A login attempt was made to your CollabDen administrator account. Please use the verification code below to securely access the dashboard.</p>
    
    <div class="amount-box" style="background: linear-gradient(135deg, #eef3fc 0%, #f0f4f8 100%); border: 2px dashed #1a3f7a; letter-spacing: 5px;">
      <div class="amount-label" style="color: #888;">Verification Code</div>
      <div class="amount-value" style="color: #1a3f7a;">${code}</div>
    </div>
    
    <div class="info-box" style="background-color: #fffbf0; border-left: 4px solid #f6a623; color: #333;">
      ⏱ This code expires in <strong>15 minutes</strong>. Do not share this code with anyone.
    </div>
    
    <div class="divider"></div>
    
    <p>If you did not initiate this login attempt, please change your password immediately or contact another Super Admin.</p>
    
    <p>
      Best regards,<br>
      <strong>CollabDen Security Team</strong>
    </p>
  `;

  return {
    html: getBaseEmailLayout({
      headerTitle: "Admin Authentication",
      headerSubtitle: "Your CollabDen Admin 2FA Code",
      headerBackground: "linear-gradient(135deg, #1a3f7a 0%, #0d2146 100%)",
      footerBackground: "#0d2146",
      content,
    }),
    text: `Your CollabDen Admin 2FA code is: ${code}. This code expires in 15 minutes.`,
  };
};

module.exports = {
  getCollabDenEmailTemplate,
  getBaseEmailLayout,
  getNotificationEmailTemplate,
  getVerificationEmailTemplate,
  getPasswordResetEmailTemplate,
  getWalletFundedEmailTemplate,
  getWithdrawalInitiatedEmailTemplate,
  getWithdrawalCompletedEmailTemplate,
  getWithdrawalFailedEmailTemplate,
  getAdmin2FAEmailTemplate,
};
