/* ═══════════════════════════════════════════════════════════════════════════
   CONTACT FORM — Updated main.js snippet
   ───────────────────────────────────────
   Replace the contact form section in your existing main.js with this block.
   Change BACKEND_URL to your deployed backend URL (or localhost for testing).
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── BACKEND URL (change this when you deploy) ── */
const BACKEND_URL = 'http://localhost:3001'; // e.g. 'https://your-backend.onrender.com'

/* ── CONTACT FORM ── */
(function initContactForm() {
  const form       = document.getElementById('contact-form');
  const submitBtn  = document.getElementById('contact-submit');
  const statusDiv  = document.getElementById('form-status');

  if (!form) return; // safety guard if element not found

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Collect values
    const name    = document.getElementById('contact-name')?.value.trim();
    const email   = document.getElementById('contact-email')?.value.trim();
    const subject = document.getElementById('contact-subject')?.value.trim() || 'Portfolio Inquiry';
    const message = document.getElementById('contact-message')?.value.trim();

    // Simple client-side validation
    if (!name || !email || !message) {
      showStatus('error', 'Please fill in all required fields.');
      return;
    }

    // Disable button and show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-spinner"></span> Sending…';

    try {
      const res = await fetch(`${BACKEND_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showStatus('success', data.message || '✅ Message sent! I\'ll get back to you soon.');
        form.reset();
      } else {
        showStatus('error', data.error || '❌ Failed to send message. Please try again.');
      }
    } catch (err) {
      showStatus('error', '❌ Network error. Make sure the backend server is running.');
      console.error('Contact form error:', err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Send Message</span>';
    }
  });

  function showStatus(type, msg) {
    if (!statusDiv) return;
    statusDiv.textContent = msg;
    statusDiv.className   = `form-status form-status--${type}`;
    statusDiv.style.display = 'block';
    // Auto-hide success after 6s
    if (type === 'success') {
      setTimeout(() => { statusDiv.style.display = 'none'; }, 6000);
    }
  }
})();
