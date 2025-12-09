const asyncHandler = require("express-async-handler");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const notificationController = {
  // Send OTP Email
  SendEmail: asyncHandler(async (req, res) => {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || !text) {
        return res.status(400).json({ message: "Missing required fields (to, subject, text)" });
    }

    try {
      // Gửi email bằng Resend
      await resend.emails.send({
        from: "onboarding@resend.dev",
        to,
        subject,
        text,
        html,
      });

      res.json({
        success: true,
        message: "Notification sent successfully via Resend",
      });
    } catch (error) {
      console.error("Error sending email via Resend:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send email notification",
      });
    }
  }),
};

module.exports = notificationController;
