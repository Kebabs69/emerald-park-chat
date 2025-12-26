const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(cors());

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadDir));

// Database connection
const mongoURI = process.env.MONGO_URI; 
mongoose.connect(mongoURI)
    .then(() => console.log("☕ Database Connected Successfully"))
    .catch(err => console.log("❌ DB Error:", err));

// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true }, 
    email: { type: String, unique: true, required: true }, 
    password: { type: String, required: true }, 
    isAdmin: { type: Boolean, default: false },
    isVIP: { type: Boolean, default: false }, 
    isMuted: { type: Boolean, default: false }, 
    isBanned: { type: Boolean, default: false },
    avatar: { type: String, default: '👤' },
    bio: { type: String, default: "Networking on Civility Chat!" },
    status: { type: String, default: "Online" },
    lastSeen: { type: Date, default: Date.now }, 
    joinDate: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// Message Schema
const MessageSchema = new mongoose.Schema({
    username: String, 
    email: String, 
    text: String, 
    room: String, 
    avatar: String, 
    isAdmin: { type: Boolean, default: false }, 
    isVIP: { type: Boolean, default: false },
    imageUrl: { type: String, default: null }, 
    recipientEmail: { type: String, default: null }, 
    isAnnouncement: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// API Routes
app.post('/api/register', async (req, res) => {
    try {
        const count = await User.countDocuments();
        const user = new User({ 
            ...req.body, 
            isAdmin: count === 0, 
            isVIP: count === 0 
        });
        await user.save();
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: "Registration failed" }); 
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (user) {
            if (user.isBanned) return res.status(403).json("Account Banned");
            res.json(user);
        } else {
            res.status(401).json("Invalid credentials");
        }
    } catch (err) { 
        res.status(500).json("Login error"); 
    }
});

app.get('/api/messages', async (req, res) => {
    try {
        const { room, userEmail } = req.query;
        let query = room === 'DM' ? { room: 'DM', $or: [{ email: userEmail }, { recipientEmail: userEmail }] } : { room };
        const messages = await Message.find(query).sort({ timestamp: 1 });
        res.json(messages);
    } catch (err) { res.status(500).json([]); }
});

app.post('/api/messages', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user || user.isBanned || user.isMuted) return res.status(403).json("Forbidden");
        const msg = new Message({ ...req.body, username: user.username, avatar: user.avatar, isAdmin: user.isAdmin, isVIP: user.isVIP });
        await msg.save();
        res.json(msg);
    } catch (err) { res.status(500).json("Failed"); }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 SERVER RUNNING ON: ${PORT}`));