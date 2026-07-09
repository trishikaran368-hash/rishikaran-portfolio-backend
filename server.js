/* ═══════════════════════════════════════════════════════════════════════════
   Rishikaran Portfolio — Backend Server
   ─────────────────────────────────────
   Provides:
     POST /api/contact   → Stores message in JSON + sends email notification
     GET  /api/messages  → View all received messages (admin endpoint)
     GET  /api/health    → Health check
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const nodemailer = require('nodemailer');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const low        = require('lowdb');
const FileSync   = require('lowdb/adapters/FileSync');

/* ── Express App ── */
const app  = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

/* ── JSON File Database (lowdb) ── */
const adapter = new FileSync(path.join(__dirname, 'messages.json'));
const db      = low(adapter);

// Set default structure
db.defaults({ messages: [] }).write();

/* ── CORS ── */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-admin-token'],
}));

/* ── Body Parser ── */
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

/* ── Rate Limiter (anti-spam) ── */
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // max 5 submissions per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many messages sent. Please wait 15 minutes before trying again.'
  },
});

/* ── Nodemailer Transporter ── */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
});
transporter.verify(function (error, success) {
  if (error) {
    console.error('SMTP ERROR:', error);
  } else {
    console.log('SMTP SERVER READY');
  }
});
/* ── Helper: Validate Email ── */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ══════════════════════════════════════════════════════
   ROUTES
   ══════════════════════════════════════════════════════ */

/* ── GET /api/health ── */
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    totalMessages: db.get('messages').size().value(),
  });
});

/* ── POST /api/contact ── */
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, subject = 'Portfolio Inquiry', message } = req.body;

  /* ─ Validation ─ */
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: 'Name, email, and message are required.' });
  }
  if (String(name).trim().length < 2 || String(name).trim().length > 100) {
    return res.status(400).json({ success: false, error: 'Name must be between 2 and 100 characters.' });
  }
  if (!isValidEmail(String(email).trim())) {
    return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
  }
  if (String(message).trim().length < 10 || String(message).trim().length > 5000) {
    return res.status(400).json({ success: false, error: 'Message must be between 10 and 5000 characters.' });
  }

  const sanitized = {
    id:         Date.now(),
    name:       String(name).trim(),
    email:      String(email).trim().toLowerCase(),
    subject:    String(subject).trim() || 'Portfolio Inquiry',
    message:    String(message).trim(),
    ip:         req.ip,
    created_at: new Date().toISOString(),
  };

  /* ─ Save to JSON file ─ */
  try {
    db.get('messages').push(sanitized).write();
    console.log(`[DB] Message saved — ID: ${sanitized.id} from ${sanitized.email}`);
  } catch (dbErr) {
    console.error('[DB] Save error:', dbErr.message);
  }

  /* ─ Send Email Notification ─ */
  try {
  await resend.emails.send({
  from: "Portfolio Contact <onboarding@resend.dev>",
  to: process.env.EMAIL_TO,
  replyTo: sanitized.email,
  subject: `📩 New Portfolio Message: ${sanitized.subject}`,
  html: `
    <h2>New Portfolio Contact</h2>

    <p><strong>Name:</strong> ${sanitized.name}</p>
    <p><strong>Email:</strong> ${sanitized.email}</p>
    <p><strong>Subject:</strong> ${sanitized.subject}</p>
    <p><strong>Message:</strong></p>
    <p>${sanitized.message}</p>
  `,
});

console.log(`[EMAIL] Notification sent for message from ${sanitized.email}`);
} catch (emailErr) {
  console.error("[EMAIL] Send error:", emailErr);

  return res.status(500).json({
    success: false,
    error: "Message saved but email notification failed.",
  });
}

  res.status(200).json({
    success: true,
    message: `Thank you, ${sanitized.name}! Your message has been received. I'll get back to you soon.`,
  });
});

/* ── GET /api/messages — View all messages (Admin) ── */
app.get('/api/messages', (req, res) => {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (process.env.ADMIN_TOKEN && token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Provide ?token=YOUR_ADMIN_TOKEN' });
  }

  const messages = db.get('messages').orderBy('created_at', 'desc').value();
  res.json({ success: true, count: messages.length, messages });
});

/* ── 404 ── */
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

/* ── Global Error Handler ── */
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ success: false, error: 'Internal server error.' });
});

/* ── Start ── */
app.listen(PORT, () => {
  console.log(`\n⚙️  Rishikaran Portfolio Backend`);
  console.log(`   Server running at http://localhost:${PORT}`);
  console.log(`   Health check:  GET  http://localhost:${PORT}/api/health`);
  console.log(`   Contact form:  POST http://localhost:${PORT}/api/contact`);
  console.log(`   View messages: GET  http://localhost:${PORT}/api/messages?token=YOUR_ADMIN_TOKEN\n`);
});
