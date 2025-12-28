// Firebase Configuration - REPLACE WITH YOUR CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDfA2UQYAO4xnx2vMy6DFKc4k4452zbfA8",
  authDomain: "tryui-105ff.firebaseapp.com",
  projectId: "tryui-105ff",
  storageBucket: "tryui-105ff.firebasestorage.app",
  messagingSenderId: "655365268884",
  appId: "1:655365268884:web:1f861594ab8d68c8919b81",
  measurementId: "G-9XQNXJW387"
};

// Global variables
let allEmails = [];
let mailboxes = [];
let currentUser = null;
let auth, db, functions;

// Initialize Firebase only if config is valid
function initializeFirebase() {
    try {
        if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
            firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.firestore();
            functions = firebase.functions();
            console.log('Firebase initialized successfully');
        } else {
            console.log('Firebase not configured - Demo mode only');
        }
    } catch (error) {
        console.log('Firebase initialization error - Demo mode only', error);
    }
}

// Call initialization
initializeFirebase();

// Login Function
function login() {
    console.log('Login button clicked!'); // Debug
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    console.log('Username:', username); // Debug
    console.log('Password:', password ? '***' : 'empty'); // Debug
    
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }
    
    // Demo mode
    if (username === 'demo' && password === 'demo123') {
        console.log('Demo login successful!');
        currentUser = { email: 'demo@example.com', uid: 'demo-user' };
        showDashboard();
        loadDemoData();
        return;
    }
    
    // Firebase Authentication
    if (auth) {
        auth.signInWithEmailAndPassword(username, password)
            .then((userCredential) => {
                currentUser = userCredential.user;
                showDashboard();
                loadUserData();
            })
            .catch((error) => {
                alert('Login failed: ' + error.message);
            });
    } else {
        alert('Firebase not configured. Use demo mode: username: demo, password: demo123');
    }
}

// Logout Function
function logout() {
    if (auth) {
        auth.signOut().then(() => {
            currentUser = null;
            allEmails = [];
            mailboxes = [];
            showLogin();
        });
    } else {
        currentUser = null;
        allEmails = [];
        mailboxes = [];
        showLogin();
    }
}

// Show/Hide Screens
function showLogin() {
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('dashboardScreen').classList.remove('active');
}

function showDashboard() {
    console.log('Showing dashboard...');
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('dashboardScreen').classList.add('active');
}

// Load Demo Data
function loadDemoData() {
    console.log('Loading demo data...');
    
    mailboxes = [
        { 
            id: '1', 
            email: 'trevrobo.51@bigpond.com', 
            host: 'mail.bigpond.com', 
            port: '995' 
        }
    ];
    
    allEmails = generateDemoEmails();
    renderMailboxes();
    renderEmails();
    updateStatistics();
    
    console.log('Demo data loaded successfully!');
}

// Generate Demo Emails
function generateDemoEmails() {
    const senders = ['Campaign A', 'Campaign B', 'Newsletter X', 'Promo Y', 'Marketing Team'];
    const subjects = [
        'Test After - Campaign Results',
        'Weekly Newsletter Update',
        'Special Offer Inside',
        'Test After - 100 Messages Sent',
        'Your Monthly Report',
        'New Product Launch',
        'Test After - Performance Update',
        'Exclusive Deal for You'
    ];
    
    const emails = [];
    for (let i = 0; i < 50; i++) {
        const subject = subjects[Math.floor(Math.random() * subjects.length)];
        emails.push({
            id: 'demo-' + i,
            from: senders[Math.floor(Math.random() * senders.length)],
            subject: subject,
            date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            body: 'Email content here...',
            isTestAfter: subject.includes('Test After')
        });
    }
    
    return emails;
}

// Add Mailbox
function addMailbox() {
    const email = document.getElementById('mailboxEmail').value;
    const password = document.getElementById('mailboxPassword').value;
    const host = document.getElementById('mailboxHost').value;
    const port = document.getElementById('mailboxPort').value;
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    const mailbox = {
        id: Date.now().toString(),
        email: email,
        password: password,
        host: host,
        port: port,
        userId: currentUser.uid
    };
    
    // Save to Firestore if available
    if (db) {
        db.collection('mailboxes').add(mailbox)
            .then(() => {
                mailboxes.push(mailbox);
                renderMailboxes();
                
                document.getElementById('mailboxEmail').value = '';
                document.getElementById('mailboxPassword').value = '';
                
                alert('Mailbox added successfully!');
            })
            .catch((error) => {
                console.error('Error adding mailbox:', error);
                alert('Error adding mailbox. In demo mode, mailbox added locally.');
                mailboxes.push(mailbox);
                renderMailboxes();
            });
    } else {
        // Demo mode - add locally
        mailboxes.push(mailbox);
        renderMailboxes();
        alert('Mailbox added (demo mode)');
    }
}

// Render Mailboxes
function renderMailboxes() {
    const mailboxList = document.getElementById('mailboxList');
    
    if (mailboxes.length === 0) {
        mailboxList.innerHTML = '<p class="empty-state">No mailboxes added yet.</p>';
        return;
    }
    
    mailboxList.innerHTML = mailboxes.map(mailbox => `
        <div class="mailbox-item">
            <div class="mailbox-info">
                <p>${mailbox.email}</p>
                <p>${mailbox.host}:${mailbox.port}</p>
            </div>
            <button class="btn-fetch" onclick="fetchEmails('${mailbox.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                Fetch
            </button>
        </div>
    `).join('');
}

// Fetch Emails from Mailbox
async function fetchEmails(mailboxId) {
    // ⛔ إذا demo user → ما تناديش Cloud Function
    if (!auth || !auth.currentUser) {
        console.log("Demo mode: skipping Cloud Function");

        const newEmails = generateDemoEmails();
        allEmails = [...allEmails, ...newEmails];
        renderEmails();
        updateStatistics();
        alert('Demo: Emails fetched successfully!');
        return;
    }

    const button = event.target.closest('.btn-fetch');
    const svg = button.querySelector('svg');

    button.disabled = true;
    svg.classList.add('rotate');

    try {
        const fetchEmailsFunction = functions.httpsCallable('fetchEmails');
        const result = await fetchEmailsFunction({ mailboxId });

        allEmails = result.data.emails || [];
        renderEmails();
        updateStatistics();

        alert('Emails fetched successfully!');
    } catch (error) {
        console.error('Error fetching emails:', error.message);
        alert(error.message);
    } finally {
        button.disabled = false;
        svg.classList.remove('rotate');
    }
}


// Filter Emails
function filterEmails() {
    const searchTerm = document.getElementById('searchTerm').value.toLowerCase();
    const filterType = document.getElementById('filterType').value;
    
    let filtered = allEmails;
    
    if (filterType === 'testAfter') {
        filtered = filtered.filter(email => email.isTestAfter);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(email => 
            email.from.toLowerCase().includes(searchTerm) ||
            email.subject.toLowerCase().includes(searchTerm)
        );
    }
    
    renderEmails(filtered);
}

// Render Emails
function renderEmails(emails = allEmails) {
    const emailList = document.getElementById('emailList');
    const emailCount = document.getElementById('emailCount');
    
    emailCount.textContent = emails.length;
    
    if (emails.length === 0) {
        emailList.innerHTML = '<p class="empty-state">No emails found.</p>';
        return;
    }
    
    emailList.innerHTML = emails.map(email => `
        <div class="email-item">
            <div class="email-header">
                <span class="email-from">${email.from}</span>
                ${email.isTestAfter ? '<span class="badge">Test After</span>' : ''}
            </div>
            <p class="email-subject">${email.subject}</p>
            <p class="email-date">${new Date(email.date).toLocaleString()}</p>
        </div>
    `).join('');
}

// Update Statistics
function updateStatistics() {
    const totalEmails = allEmails.length;
    const testAfterCount = allEmails.filter(e => e.isTestAfter).length;
    const uniqueSenders = [...new Set(allEmails.map(e => e.from))].length;
    
    document.getElementById('totalEmails').textContent = totalEmails;
    document.getElementById('testAfterCount').textContent = testAfterCount;
    document.getElementById('uniqueSenders').textContent = uniqueSenders;
}

// Load User Data from Firestore
function loadUserData() {
    if (!currentUser || !db) return;
    
    // Load mailboxes
    db.collection('mailboxes')
        .where('userId', '==', currentUser.uid)
        .get()
        .then((querySnapshot) => {
            mailboxes = [];
            querySnapshot.forEach((doc) => {
                mailboxes.push({ id: doc.id, ...doc.data() });
            });
            renderMailboxes();
        });
    
    // Load emails
    db.collection('emails')
        .where('userId', '==', currentUser.uid)
        .orderBy('date', 'desc')
        .limit(100)
        .get()
        .then((querySnapshot) => {
            allEmails = [];
            querySnapshot.forEach((doc) => {
                allEmails.push({ id: doc.id, ...doc.data() });
            });
            renderEmails();
            updateStatistics();
        });
}

// Listen for Enter key on login
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up event listeners...');
    
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginButton = document.querySelector('.btn-primary');
    
    if (usernameInput) {
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                console.log('Enter pressed on username');
                login();
            }
        });
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                console.log('Enter pressed on password');
                login();
            }
        });
    }
    
    // Make sure login button works
    if (loginButton) {
        loginButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Login button clicked via event listener');
            login();
        });
    }
    
    console.log('Event listeners set up successfully!');
});
