require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

// In-memory active session store (for serverless sessions)
let currentAdminToken = null;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Atlas Connection (Cached for Serverless)
let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  const dbUri = process.env.MONGO_URI;
  if (!dbUri) {
    console.error("CRITICAL: MONGO_URI is missing in Environment Variables!");
    return;
  }
  try {
    await mongoose.connect(dbUri);
    isConnected = true;
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("MongoDB Connection Error:", err.message);
  }
}
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Schemas & Models
const ProfileSchema = new mongoose.Schema({
  tagline: {
    type: String,
    default: "Full-Stack Web Developer & Data Analytics Enthusiast. Specializing in high-performance React architectures, Node.js micro-services, Power BI reporting, and AI integrations."
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

// Admin Auth Middleware
function verifyAdmin(req, res, next) {
  const token = req.headers['authorization'];
  if (!token || !currentAdminToken || token !== currentAdminToken) {
    return res.status(403).json({ success: false, message: "Unauthorized access: Invalid or expired session." });
  }
  next();
}

// Admin Verification (Dynamic Cryptographic Token)
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD;

  if (!adminPass) {
    return res.status(500).json({ success: false, message: "ADMIN_PASSWORD not set in server configuration." });
  }

  if (password === adminPass) {
    currentAdminToken = crypto.randomBytes(32).toString('hex');
    return res.json({ success: true, token: currentAdminToken });
  }
  return res.status(401).json({ success: false, message: "Invalid Owner Password" });
});

// Profile Tagline Routes
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

// Contact Links CRUD Routes
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

// Admin Message Inbox Routes
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

// Card CRUD Endpoints
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

// Contact Route
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
        to: 'shrishtyagi2004@gmail.com',
        subject: `New Portfolio Message from ${name}`,
        text: `Sender Name: ${name}\nSender Email: ${email}\n\nMessage:\n${message}`
      };

      await transporter.sendMail(mailOptions).catch(err => {
        console.warn("Nodemailer dispatch notice:", err.message);
      });
    }

    res.json({ success: true, message: "Message sent and stored successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to process message." });
  }
});

// Initial / Force Reseed Endpoint (Protected with Admin Session or Master Secret)
app.get('/api/seed', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const masterSecret = req.query.secret;

  // Protect against random public resets
  if (authHeader !== currentAdminToken && masterSecret !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ error: "Unauthorized. Pass ?secret=YOUR_ADMIN_PASSWORD or login to reseed." });
  }

  try {
    await Card.deleteMany({});
    await ContactLink.deleteMany({});

    let profile = await Profile.findOne();
    if (!profile) await Profile.create({});

    const seedContacts = [
      { label: 'shrishtyagi2004@gmail.com', url: 'mailto:shrishtyagi2004@gmail.com', icon: 'fa-solid fa-envelope' },
      { label: '+91 9627727998', url: 'tel:+919627727998', icon: 'fa-solid fa-phone' },
      { label: 'GitHub', url: 'https://github.com', icon: 'fa-brands fa-github' },
      { label: 'LinkedIn', url: 'https://linkedin.com', icon: 'fa-brands fa-linkedin-in' }
    ];
    await ContactLink.insertMany(seedContacts);

    const resumeData = [
      {
        section: 'experience',
        title: 'Microsoft Elevate - (AICTE)',
        subtitle: 'Intern Power BI (Virtual)',
        period: 'Feb. 2026 - Mar. 2026',
        description: [
          'Selected for the Microsoft Elevate 4-week Internship Program focusing on Power BI.',
          'Engaged in hands-on practice to identify real-world problem statements and develop them into project solutions under mentor guidance.'
        ],
        tags: ['Power BI', 'Data Analytics', 'AICTE'],
        gallery: [],
        links: { certificatePdf: '/uploads/microsoft_cert.pdf' }
      },
      {
        section: 'experience',
        title: 'DRDO - TBRL',
        subtitle: 'Intern Full-Stack Web-Development (Chandigarh Sector 30)',
        period: 'July 2025 - Dec. 2025',
        description: [
          'Developing a full-stack web-base complaint management dashboard (React, Node.js) to replace a manual system, significantly improving operational efficiency.',
          'Implementing a backend that uses Excel for data handling and automates the generation of official Word reports for streamlined record-keeping.'
        ],
        tags: ['React', 'Node.js', 'Excel Automation', 'Word Reporting'],
        gallery: [],
        links: { certificatePdf: '/uploads/drdo_cert.pdf', lorPdf: '/uploads/drdo_lor.pdf' }
      },
      {
        section: 'experience',
        title: 'ISGEC HEAVY ENGINEERING LTD.',
        subtitle: 'Intern SAP ABAP Consultant (Noida Sector 63)',
        period: 'June 2025 - July 2025',
        description: [
          'Applied foundational SAP ABAP skills to develop custom reports, debug programs, and enhance business modules under consultant mentorship.',
          'Gained practical experience within a live SAP ERP environment to support core business processes for a global engineering firm.'
        ],
        tags: ['SAP ABAP', 'ERP', 'Debugging', 'Enterprise Reports'],
        gallery: [],
        links: { certificatePdf: '/uploads/isgec_cert.pdf' }
      },
      {
        section: 'projects',
        title: 'Voice-Controlled Virtual Assistant',
        subtitle: 'AI & Speech Automation',
        period: 'March 2025',
        description: [
          "Built an AI-powered virtual assistant that uses voice commands to perform tasks, leveraging OpenAI's GPT for advanced conversational abilities.",
          'Engineered the complete voice interaction system, implementing SpeechRecognition for input and gTTS/pygame for text-to-speech output.'
        ],
        tags: ['Python', 'SpeechRecognition', 'OpenAI', 'gTTS', 'pygame'],
        gallery: [
          'https://images.unsplash.com/photo-1589254065878-42c9da997008?w=900&auto=format&fit=crop',
          'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
        ],
        links: { github: 'https://github.com' }
      },
      {
        section: 'projects',
        title: 'Responsive Music Player',
        subtitle: 'Dynamic Frontend Web Application',
        period: 'Aug 2025',
        description: [
          'Built a responsive music player from scratch using HTML, CSS, and JavaScript, featuring dynamic song loading and full playback controls.',
          'Implemented asynchronous JavaScript to fetch music from a server folder and dynamically update the UI, creating an interactive and seamless user experience.'
        ],
        tags: ['HTML', 'CSS', 'JavaScript', 'Async API'],
        gallery: ['https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=900&auto=format&fit=crop'],
        links: { github: 'https://github.com' }
      },
      {
        section: 'certificates',
        title: 'Python for Data Science (Elite)',
        subtitle: 'IIT Madras (NPTEL)',
        period: 'Jan 2026 - Feb 2026',
        description: [
          'Completed an intensive 4-week certification course funded by the Ministry of Education (MoE), Government of India.',
          'Awarded Elite certification tier for high performance.'
        ],
        tags: ['Python', 'Data Science', 'IIT Madras', 'MoE'],
        gallery: ['https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=900&auto=format&fit=crop'],
        links: { certificatePdf: '/uploads/nptel_python_cert.pdf' }
      },
      {
        section: 'certificates',
        title: 'Freedom Employability Academy (FEA)',
        subtitle: 'Professional Development & Soft Skills',
        period: 'March 2022 - Oct 2022',
        description: [
          'Completed training covering communication skills, professional presentation, soft skills, and group discussion methodologies.'
        ],
        tags: ['Communication', 'Soft Skills', 'Leadership'],
        gallery: ['https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&auto=format&fit=crop'],
        links: { certificatePdf: '/uploads/fea_cert.pdf' }
      },
      {
        section: 'education',
        title: 'Bachelor of Technology in Computer Science and Engineering (AI and ML)',
        subtitle: 'Dr. A.P.J. Abdul Kalam Technical University (AKTU) • Lucknow, Uttar Pradesh',
        period: '2022 - 2026',
        description: [
          'Specialization in Artificial Intelligence and Machine Learning (AI and ML).',
          'Coursework covers Full-Stack Web Development, Data Structures, Algorithms, Machine Learning, and Database Management Systems.'
        ],
        tags: ['B.Tech', 'CSE (AI & ML)', 'AKTU', 'Undergraduate'],
        gallery: [],
        links: {}
      },
      {
        section: 'education',
        title: 'Intermediate (Class XII)',
        subtitle: 'Central Board of Secondary Education (CBSE) • New Delhi',
        period: 'May 2021 - March 2022',
        description: ['Completed Senior Secondary Education under Central Board of Secondary Education (CBSE), New Delhi.'],
        tags: ['CBSE', 'Class 12th', 'Senior Secondary'],
        gallery: [],
        links: {}
      },
      {
        section: 'education',
        title: 'Matriculation (Class X)',
        subtitle: 'Central Board of Secondary Education (CBSE) • New Delhi',
        period: 'May 2019 - March 2020',
        description: ['Completed High School Matriculation Examination under Central Board of Secondary Education (CBSE), New Delhi.'],
        tags: ['CBSE', 'Class 10th', 'Matriculation'],
        gallery: [],
        links: {}
      },
      {
        section: 'skills',
        title: 'Programming Languages',
        icon: 'fa-solid fa-code',
        subtitle: '',
        period: '',
        description: [],
        tags: ['Python', 'C', 'HTML', 'CSS', 'Java', 'JavaScript', 'Node.js'],
        gallery: [],
        links: {}
      },
      {
        section: 'skills',
        title: 'Developer Tools',
        icon: 'fa-solid fa-screwdriver-wrench',
        subtitle: '',
        period: '',
        description: [],
        tags: ['Power BI', 'VS Code', 'GitHub', 'Google AntiGravity'],
        gallery: [],
        links: {}
      },
      {
        section: 'skills',
        title: 'Database Languages',
        icon: 'fa-solid fa-database',
        subtitle: '',
        period: '',
        description: [],
        tags: ['MySQL', 'MongoDB'],
        gallery: [],
        links: {}
      }
    ];

    await Card.insertMany(resumeData);
    res.json({ success: true, message: "Database reseeded securely." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start local server if not on serverless host
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running locally on http://localhost:${PORT}`));
}

// Export for Vercel Serverless Function
module.exports = app;