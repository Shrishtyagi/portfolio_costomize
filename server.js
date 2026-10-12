require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "Shrish@2026").trim();
const MONGO_URI = (process.env.MONGO_URI || "mongodb+srv://Cluster0:Cluster001@cluster0.kznta.mongodb.net/portfolioDB?appName=Cluster0").trim();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Atlas Connection (Optimized for Serverless Execution)
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("MongoDB Connection Error:", err.message);
  }
}

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Database Schemas & Models
const ProfileSchema = new mongoose.Schema({
  tagline: {
    type: String,
    default: "Full-Stack Web Developer & Data Analytics Enthusiast. Specializing in high-performance web applications and systems."
  }
});
const Profile = mongoose.model('Profile', ProfileSchema);

const ContactLinkSchema = new mongoose.Schema({
  label: { type: String, required: true },
  url: { type: String, required: true },
  icon: { type: String, default: 'fa-solid fa-link' }
});
const ContactLink = mongoose.model('ContactLink', ContactLinkSchema);

const MessageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

const CardSchema = new mongoose.Schema({
  section: { type: String, required: true },
  title: { type: String, required: true },
  subtitle: String,
  period: String,
  description: [String],
  tags: [String],
  icon: { type: String, default: '' },
  gallery: { type: [String], default: [] },
  links: {
    github: String,
    demo: String,
    certificatePdf: String,
    lorPdf: String
  }
}, { strict: false });
const Card = mongoose.model('Card', CardSchema);

// Bulletproof Serverless Auth Middleware
function verifyAdmin(req, res, next) {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(403).json({ success: false, message: "Authorization token missing." });
  }

  // 1. Direct password match or legacy session token
  if (token === ADMIN_PASSWORD || token === "admin-session-active") {
    return next();
  }

  // 2. Cryptographic HMAC Token verification
  if (token.includes('.')) {
    try {
      const [timeStr, signature] = token.split('.');
      const expectedSig = crypto.createHmac('sha256', ADMIN_PASSWORD).update(timeStr).digest('hex');
      if (expectedSig === signature) {
        return next();
      }
    } catch (err) {
      // Signature parsing error, proceed to 403
    }
  }

  return res.status(403).json({ success: false, message: "Invalid or expired session. Please login again." });
}

// -----------------------------------------------------------------------------
// API ROUTES
// -----------------------------------------------------------------------------

// 1. Admin Verification
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;

  if (password && password.trim() === ADMIN_PASSWORD) {
    const timeStr = Date.now().toString();
    const signature = crypto.createHmac('sha256', ADMIN_PASSWORD).update(timeStr).digest('hex');
    const token = `${timeStr}.${signature}`;
    return res.json({ success: true, token });
  }

  return res.status(401).json({ success: false, message: "Invalid Owner Password" });
});

// 2. Profile Tagline / Bio Routes
app.get('/api/profile', async (req, res) => {
  try {
    let profile = await Profile.findOne();
    if (!profile) profile = await Profile.create({});
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/profile', verifyAdmin, async (req, res) => {
  try {
    let profile = await Profile.findOne();
    if (!profile) {
      profile = new Profile(req.body);
    } else {
      profile.tagline = req.body.tagline;
    }
    await profile.save();
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Contact Links CRUD Routes
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await ContactLink.find({});
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contacts', verifyAdmin, async (req, res) => {
  try {
    const newContact = new ContactLink(req.body);
    await newContact.save();
    res.json(newContact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/contacts/:id', verifyAdmin, async (req, res) => {
  try {
    const updated = await ContactLink.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/contacts/:id', verifyAdmin, async (req, res) => {
  try {
    await ContactLink.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Portfolio Cards CRUD Routes
app.get('/api/cards', async (req, res) => {
  try {
    const cards = await Card.find({});
    res.json(cards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cards', verifyAdmin, async (req, res) => {
  try {
    const newCard = new Card(req.body);
    await newCard.save();
    res.json(newCard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/cards/:id', verifyAdmin, async (req, res) => {
  try {
    const updated = await Card.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: false });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cards/:id', verifyAdmin, async (req, res) => {
  try {
    await Card.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Admin Received Messages Routes
app.get('/api/messages', verifyAdmin, async (req, res) => {
  try {
    const messages = await Message.find({}).sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/messages/:id', verifyAdmin, async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Contact Form Message Dispatch & Storage
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: "All fields are required." });
  }

  try {
    await Message.create({ name, email, message });

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const mailOptions = {
        from: `"${name}" <${process.env.EMAIL_USER}>`,
        replyTo: email,
        to: process.env.EMAIL_USER,
        subject: `New Portfolio Message from ${name}`,
        text: `Sender Name: ${name}\nSender Email: ${email}\n\nMessage:\n${message}`
      };

      await transporter.sendMail(mailOptions).catch(err => {
        console.warn("Nodemailer dispatch alert:", err.message);
      });
    }

    res.json({ success: true, message: "Message sent and stored successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to process message." });
  }
});

// Start server locally if not in a serverless environment
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running locally on http://localhost:${PORT}`));
}

// Export for Vercel Serverless Function
module.exports = app;