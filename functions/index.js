const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Imap = require('imap');
const { simpleParser } = require('mailparser');

admin.initializeApp();
const db = admin.firestore();

exports.fetchEmails = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated'
        );
    }

    const { mailboxId } = data;
    const userId = context.auth.uid;

    try {
        const mailboxDoc = await db.collection('mailboxes').doc(mailboxId).get();
        
        if (!mailboxDoc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'Mailbox not found'
            );
        }

        const mailbox = mailboxDoc.data();
        
        if (mailbox.userId !== userId) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Access denied'
            );
        }

        const imap = new Imap({
            user: mailbox.email,
            password: mailbox.password,
            host: mailbox.host,
            port: parseInt(mailbox.port),
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        });

        const emails = await new Promise((resolve, reject) => {
            const fetchedEmails = [];

            imap.once('ready', () => {
                imap.openBox('INBOX', true, (err, box) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const fetch = imap.seq.fetch('1:100', {
                        bodies: '',
                        struct: true
                    });

                    fetch.on('message', (msg, seqno) => {
                        let buffer = '';

                        msg.on('body', (stream, info) => {
                            stream.on('data', (chunk) => {
                                buffer += chunk.toString('utf8');
                            });
                        });

                        msg.once('end', async () => {
                            try {
                                const parsed = await simpleParser(buffer);
                                
                                const email = {
                                    from: parsed.from.text,
                                    subject: parsed.subject,
                                    date: parsed.date.toISOString(),
                                    body: parsed.text || parsed.html || '',
                                    isTestAfter: parsed.subject.toLowerCase().includes('test after'),
                                    userId: userId,
                                    mailboxId: mailboxId,
                                    messageId: parsed.messageId
                                };

                                fetchedEmails.push(email);
                            } catch (parseError) {
                                console.error('Error parsing email:', parseError);
                            }
                        });
                    });

                    fetch.once('error', (err) => {
                        reject(err);
                    });

                    fetch.once('end', () => {
                        imap.end();
                        resolve(fetchedEmails);
                    });
                });
            });

            imap.once('error', (err) => {
                reject(err);
            });

            imap.connect();
        });

        const batch = db.batch();
        
        for (const email of emails) {
            const existingEmail = await db.collection('emails')
                .where('userId', '==', userId)
                .where('messageId', '==', email.messageId)
                .get();

            if (existingEmail.empty) {
                const emailRef = db.collection('emails').doc();
                batch.set(emailRef, {
                    ...email,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }

        await batch.commit();

        return {
            success: true,
            count: emails.length,
            emails: emails
        };

    } catch (error) {
        console.error('Error fetching emails:', error);
        throw new functions.https.HttpsError(
            'internal',
            'Failed to fetch emails: ' + error.message
        );
    }
});

exports.getStatistics = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated'
        );
    }

    const userId = context.auth.uid;

    try {
        const emailsSnapshot = await db.collection('emails')
            .where('userId', '==', userId)
            .get();

        const emails = [];
        emailsSnapshot.forEach(doc => {
            emails.push(doc.data());
        });

        const totalEmails = emails.length;
        const testAfterCount = emails.filter(e => e.isTestAfter).length;
        const uniqueSenders = [...new Set(emails.map(e => e.from))].length;

        const bySender = emails.reduce((acc, email) => {
            const sender = email.from;
            acc[sender] = (acc[sender] || 0) + 1;
            return acc;
        }, {});

        return {
            totalEmails,
            testAfterCount,
            uniqueSenders,
            bySender
        };

    } catch (error) {
        console.error('Error getting statistics:', error);
        throw new functions.https.HttpsError(
            'internal',
            'Failed to get statistics'
        );
    }
});
