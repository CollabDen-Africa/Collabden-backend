const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const { data, error } = await resend.emails.send({
      // Resend requires the 'from' address to be 'onboarding@resend.dev' if your domain is unverified.
      // You can only send to the email address you registered your Resend account with during testing.
      from: process.env.EMAIL_FROM || "Collabden <onboarding@resend.dev>",
      to,
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

module.exports = { sendEmail };
