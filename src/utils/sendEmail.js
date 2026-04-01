import nodemailer from "nodemailer";

const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const info = await transporter.sendMail({
    from: `"ServicePro" <${process.env.EMAIL}>`,
    to,
    subject,
    html
  });
  console.log(`Email sent to ${to} | MessageId: ${info.messageId}`);
};

export default sendEmail;