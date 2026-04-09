const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.FROM_EMAIL;
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `Collabden <${fromEmail}>`,
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
