const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

/**
 * EMERALD PARK ADVANCED SERVER
 * Features: Profile Bio, Global Announcements, Admin Delete, 
 * Room Protection, and Static Asset Management.
 */

const app = express();
app.use(express.json());
app.use(cors());

// FORCE root directory for static files to prevent "missing index.html"
app.use(express.static(path.join(__dirname)));

const mongoURI = process.env.MONGO_URI; 

mongoose.connect(mongoURI)
    .then(() => console.log("☕ Database Connected Successfully"))
    .catch(err => console.log("❌ DB Error:", err));

// --- MODELS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true }, 
    email: { type: String, unique: true, required: true }, 
    password: { type: String, required: true }, 
    isAdmin: { type: Boolean, default: false },
    isVIP: { type: Boolean, default: false }, 
    avatar: { type: String, default: '👤' },
    bio: { type: String, default: "Living life at Emerald Park!" },
    status: { type: String, default: "Online" },
    joinDate: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
    username: String, 
    email: String, 
    text: String, 
    room: String, 
    avatar: String, 
    isAdmin: { type: Boolean, default: false }, 
    isVIP: { type: Boolean, default: false },
    isAnnouncement: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// --- API ROUTES ---

// FETCH MESSAGES
app.get('/api/messages', async (req, res) => {
    try {
        const { room } = req.query;
        let query = {};
        if (room) query.room = room;
        
        // Fetch last 100 messages to prevent lag
        const messages = await Message.find(query).sort({ timestamp: 1 }).limit(100);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: "Could not fetch messages" });
    }
});

// POST MESSAGE
app.post('/api/messages', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) return res.status(403).json("User not found");

        // VIP Room Security Check
        if (req.body.room === 'VIP Lounge' && !user.isVIP && !user.isAdmin) {
            return res.status(402).json({ error: "VIP Membership Required" });
        }

        // Security: Remove HTML and trim text
        let cleanText = req.body.text.replace(/<[^>]*>?/gm, '').trim();
        if (cleanText.length === 0) return res.status(400).json("Message empty");

        const msg = new Message({
            username: user.username,
            email: user.email,
            text: cleanText,
            room: req.body.room,
            avatar: user.avatar,
            isAdmin: user.isAdmin,
            isVIP: user.isVIP,
            isAnnouncement: (user.isAdmin && req.body.isAnnouncement)
        });

        await msg.save();
        res.json(msg);
    } catch (err) {
        res.status(500).json({ error: "Server failed to save message" });
    }
});

// ADMIN DELETE ROUTE
app.delete('/api/messages/:id', async (req, res) => {
    try {
        const adminEmail = req.query.adminEmail;
        const user = await User.findOne({ email: adminEmail });
        if (user && user.isAdmin) {
            await Message.findByIdAndDelete(req.params.id);
            res.json({ success: true, message: "Message purged by Admin" });
        } else {
            res.status(403).json({ error: "Unauthorized access" });
        }
    } catch (err) { 
        res.status(500).json({ error: "Purge failed" }); 
    }
});

// USER PROFILE UPDATES
app.post('/api/update-profile', async (req, res) => {
    try {
        const { email, bio, status, avatar } = req.body;
        const updatedUser = await User.findOneAndUpdate(
            { email }, 
            { bio, status, avatar }, 
            { new: true }
        );
        res.json(updatedUser);
    } catch (err) {
        res.status(500).json({ error: "Profile update failed" });
    }
});

app.get('/api/user-status', async (req, res) => {
    const user = await User.findOne({ email: req.query.email });
    if (!user) return res.status(404).json("User missing");
    res.json({ 
        isAdmin: user.isAdmin, 
        isVIP: user.isVIP, 
        bio: user.bio, 
        status: user.status, 
        avatar: user.avatar 
    });
});

// AUTHENTICATION
app.post('/api/register', async (req, res) => {
    try {
        const count = await User.countDocuments();
        // The very first user is the Founder/Admin
        const user = new User({ 
            ...req.body, 
            isAdmin: count === 0, 
            isVIP: count === 0 
        });
        await user.save();
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: "Registration failed. Email might exist." }); 
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const user = await User.findOne({ 
            email: req.body.email, 
            password: req.body.password 
        });
        if (user) {
            res.json(user);
        } else {
            res.status(401).json("Invalid credentials");
        }
    } catch (err) {
        res.status(500).json("Login error");
    }
});

// --- SEARCH FIX: SERVE HTML IN ALL FOLDERS ---
app.get('*', (req, res) => {
    const possiblePaths = [
        path.join(__dirname, 'index.html'),
        path.join(__dirname, 'public', 'index.html'),
        path.join(process.cwd(), 'index.html')
    ];

    let found = false;
    for (let p of possiblePaths) {
        if (fs.existsSync(p)) {
            res.sendFile(p);
            found = true;
            break;
        }
    }

    if (!found) {
        res.status(404).send(`
            <h1>404: Website Files Missing</h1>
            <p>The server is running but index.html was not found in root.</p>
        `);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("------------------------------------------");
    console.log(`🚀 EMERALD PARK SERVER RUNNING ON: ${PORT}`);
    console.log(`☕ DATABASE STATUS: CONNECTED`);
    console.log("------------------------------------------");
});