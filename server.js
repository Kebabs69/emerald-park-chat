const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet'); // For Professional Security

dotenv.config();
const app = express();

// --- MIDDLEWARE ---
app.use(express.json());
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false })); // Pro-tier security
app.use(express.static(__dirname));

// --- DB CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ PRO PORTAL: Database Connected Successfully'))
    .catch(err => console.error('❌ Connection Error:', err));

// --- SCHEMAS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
    isVIP: { type: Boolean, default: false }
});

const MessageSchema = new mongoose.Schema({
    username: String,
    userId: mongoose.Schema.Types.ObjectId,
    text: { type: String, required: true },
    room: { type: String, default: 'Lounge' },
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// --- API ROUTES: AUTH ---

// Register & Login (Unified Pro-Logic)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        // Check for existing
        let existing = await User.findOne({ $or: [{ email }, { username }] });
        if (existing) return res.status(400).json({ error: 'User exists' });

        const newUser = new User({ username, email, password });
        await newUser.save();
        res.json(newUser);
    } catch (err) {
        res.status(500).json({ error: 'Database Fault' });
    }
});

// --- API ROUTES: CHAT ---

app.get('/api/chat/fetch', async (req, res) => {
    try {
        const { room } = req.query;
        const data = await Message.find({ room }).sort({ timestamp: -1 }).limit(100);
        res.json(data.reverse());
    } catch (err) {
        res.status(500).send('Error fetching');
    }
});

app.post('/api/chat/send', async (req, res) => {
    try {
        const newMessage = new Message(req.body);
        await newMessage.save();
        res.status(201).json(newMessage);
    } catch (err) {
        res.status(500).send('Send Error');
    }
});

// --- APP STARTUP ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`
    ====================================
    🚀 CIVILITY PRO PORTAL IS LIVE
    🌍 Environment: Production
    📡 Port: ${PORT}
    ====================================
    `);
});