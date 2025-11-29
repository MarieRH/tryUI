const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const cors = require('cors')({ origin: true });

admin.initializeApp();

// Helper function لقراءة emails
function getEmailStats(email, password, filterType) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: email,
      password: password,
      host: 'imap.seznam.cz',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });

    let stats = {
      inbox: { total: 0, breakdown: [] },
      spam: { total: 0, breakdown: [] },
      sent: 0
    };

    imap.once('ready', () => {
      // Check INBOX
      imap.openBox('INBOX', true, (err, box) => {
        if (err) return reject(err);
        stats.inbox.total = box.messages.total;

        // Get breakdown
        const fetch = imap.seq.fetch('1:*', {
          bodies: 'HEADER.FIELDS (FROM SUBJECT)',
          struct: true
        });

        let breakdown = {};
        
        fetch.on('message', (msg) => {
          msg.on('body', (stream) => {
            simpleParser(stream, (err, parsed) => {
              if (err) return;
              const key = filterType === 'sender' 
                ? (parsed.from?.text || 'Unknown')
                : (parsed.subject || 'No Subject');
              breakdown[key] = (breakdown[key] || 0) + 1;
            });
          });
        });

        fetch.once('end', () => {
          stats.inbox.breakdown = Object.entries(breakdown)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

          // Check Spam
          imap.openBox('Spam', true, (err, spamBox) => {
            if (!err) {
              stats.spam.total = spamBox.messages.total;
            }

            // Check Sent
            imap.openBox('Sent', true, (err, sentBox) => {
              if (!err) {
                stats.sent = sentBox.messages.total;
              }

              imap.end();
              resolve(stats);
            });
          });
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

// Cloud Function
exports.checkEmail = functions
  .region('europe-west1') // قريب ل Morocco
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { email, password, filterType } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      try {
        const stats = await getEmailStats(email, password, filterType || 'sender');
        res.status(200).json(stats);
      } catch (error) {
        console.error('IMAP Error:', error);
        res.status(500).json({ 
          error: 'Failed to connect to email server',
          details: error.message 
        });
      }
    });
  });
