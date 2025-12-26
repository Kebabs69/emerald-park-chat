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

// Support Request Schema
const SupportRequest = mongoose.model('SupportRequest', new mongoose.Schema({
    email: String,
    username: String,
    tier: String,
    status: { type: String, default: 'Pending' },
    timestamp: { type: Date, default: Date.now }
}));

// API Routes
app.get('/api/online-users', async (req, res) => {
    try {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
        const onlineUsers = await User.find({ lastSeen: { $gte: fiveMinsAgo } }).select('username avatar');
        res.json(onlineUsers);
    } catch (err) { res.status(500).json([]); }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    res.json({ url: `/uploads/${req.file.filename}` });
});

app.post('/api/admin/action', async (req, res) => {
    try {
        const admin = await User.findOne({ email: req.body.adminEmail });
        if (!admin || !admin.isAdmin) return res.status(403).json("Unauthorized");
        let update = {};
        if (req.body.action === 'ban') update = { isBanned: true };
        if (req.body.action === 'mute') update = { isMuted: true };
        if (req.body.action === 'unmute') update = { isMuted: false };
        if (req.body.action === 'makeVIP') update = { isVIP: true };
        await User.findOneAndUpdate({ email: req.body.targetEmail }, update);
        res.json({ success: true });
    } catch (err) { res.status(500).json("Action failed"); }
});

app.get('/api/messages', async (req, res) => {
    try {
        const { room, userEmail } = req.query;
        let query = {};
        if (room === 'DM') {
            query = { room: 'DM', $or: [{ email: userEmail }, { recipientEmail: userEmail }] };
        } else if (room) {
            query.room = room;
        }
        const messages = await Message.find(query).sort({ timestamp: 1 });
        res.json(messages);
    } catch (err) { res.status(500).json([]); }
});

app.post('/api/messages', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user || user.isBanned) return res.status(403).json("Unauthorized");
        if (user.isMuted) return res.status(403).json("Muted");

        const msg = new Message({
            username: user.username,
            email: user.email,
            text: req.body.text || "",
            room: req.body.room,
            avatar: user.avatar,
            isAdmin: user.isAdmin,
            isVIP: user.isVIP,
            imageUrl: req.body.imageUrl || null,
            recipientEmail: req.body.recipientEmail || null,
            isAnnouncement: (user.isAdmin && req.body.isAnnouncement)
        });
        await msg.save();
        res.json(msg);
    } catch (err) { res.status(500).json({ error: "Failed to send" }); }
});

app.post('/api/support', async (req, res) => {
    try {
        const request = new SupportRequest(req.body);
        await request.save();
        const msg = new Message({ 
            username: "SYSTEM", 
            text: `📢 UPGRADE REQUEST: ${req.body.username} has requested ${req.body.tier}.`, 
            room: "General", 
            avatar: "🎁", 
            isAdmin: true 
        });
        await msg.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.delete('/api/messages/:id', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.query.adminEmail });
        if (user && user.isAdmin) {
            await Message.findByIdAndDelete(req.params.id);
            res.json({ success: true });
        } else { res.status(403).json("Unauthorized"); }
    } catch (err) { res.status(500).json("Purge failed"); }
});

app.post('/api/update-profile', async (req, res) => {
    try {
        const { email, bio, status, avatar, lastSeen } = req.body;
        const updateData = { bio, status, avatar };
        if (lastSeen) updateData.lastSeen = lastSeen; 
        const updatedUser = await User.findOneAndUpdate({ email }, updateData, { new: true });
        res.json(updatedUser);
    } catch (err) { res.status(500).json("Failed"); }
});

app.get('/api/user-status', async (req, res) => {
    const user = await User.findOne({ email: req.query.email });
    if (!user) return res.status(404).json("Missing");
    res.json(user);
});

// REGISTER ROUTE
app.post('/api/register', async (req, res) => {
    try {
        const count = await User.countDocuments();
        const user = new User({ ...req.body, isAdmin: count === 0, isVIP: count === 0 });
        await user.save();

        const welcomeMsg = new Message({
            username: "EMERALD BOT 🤖",
            email: "system@emerald.park",
            text: `✨ New Member Alert! Welcome @${user.username}. (Email: ${user.email})`,
            room: "General",
            avatar: "💎",
            isAdmin: true,
            isAnnouncement: true
        });
        await welcomeMsg.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Registration failed" }); }
});

// LOGIN ROUTE
app.post('/api/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email, password: req.body.password });
        if (user && user.isBanned) return res.status(403).json("Account Banned");
        if (user) { res.json(user); } else { res.status(401).json("Invalid credentials"); }
    } catch (err) { res.status(500).json("Login error"); }
});

app.get('/api/profile/:email', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email }).select('username avatar bio status joinDate isAdmin isVIP');
        if (!user) return res.status(404).json("Not found");
        res.json(user);
    } catch (err) { res.status(500).json("Error"); }
});

app.get('*', (req, res) => {
    const possiblePaths = [path.join(__dirname, 'index.html'), path.join(__dirname, 'public', 'index.html'), path.join(process.cwd(), 'index.html')];
    let found = false;
    for (let p of possiblePaths) { if (fs.existsSync(p)) { res.sendFile(p); found = true; break; } }
    if (!found) res.status(404).send(`<h1>404: Website Files Missing</h1>`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 SERVER RUNNING ON: ${PORT}`));