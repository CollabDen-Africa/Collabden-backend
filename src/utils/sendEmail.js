const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const getRecipient = (to) => {
  if (process.env.NODE_ENV === "development" && process.env.EMAIL_TO) {
    return process.env.EMAIL_TO;
  }

  return to;
};

const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const recipient = getRecipient(to);
    if (recipient !== to) {
      console.log(`Development email redirect: ${to} -> ${recipient}`);
    }

    const { data, error } = await resend.emails.send({
      // Resend requires the 'from' address to be 'onboarding@resend.dev' if your domain is unverified.
      // You can only send to the email address you registered your Resend account with during testing.
      from: process.env.EMAIL_FROM || "Collabden <onboarding@resend.dev>",
      to: recipient,
      subject,
      text,
      html,
    });

    if (error) {
      console.error("Email error:", error);
      throw new Error(error.message);
    }

    console.log("Email sent:", data);
    return data;
  } catch (error) {
    console.error("sendEmail failed:", error);
    throw error;
  }
};

module.exports = { sendEmail, getRecipient };
