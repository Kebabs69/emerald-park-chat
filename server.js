const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer'); // NEW: Added for file uploads

const app = express();
app.use(express.json());
app.use(cors());

// NEW: Create uploads folder if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// NEW: Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadDir)); // NEW: Serve the uploads folder

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
    isMuted: { type: Boolean, default: false }, 
    isBanned: { type: Boolean, default: false },
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
    imageUrl: { type: String, default: null }, 
    recipientEmail: { type: String, default: null }, 
    isAnnouncement: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

const SupportRequest = mongoose.model('SupportRequest', new mongoose.Schema({
    email: String,
    username: String,
    tier: String,
    status: { type: String, default: 'Pending' },
    timestamp: { type: Date, default: Date.now }
}));

// NEW: File Upload Route
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    res.json({ url: `/uploads/${req.file.filename}` });
});

// --- MODERATION API ---
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

// --- API ROUTES ---
app.get('/api/messages', async (req, res) => {
    try {
        const { room, userEmail } = req.query;
        let query = {};
        if (room === 'DM') {
            query = { room: 'DM', $or: [{ email: userEmail }, { recipientEmail: userEmail }] };
        } else if (room) {
            query.room = room;
        }
        const messages = await Message.find(query).sort({ timestamp: 1 }).limit(100);
        res.json(messages);
    } catch (err) { res.status(500).json({ error: "Could not fetch messages" }); }
});

app.post('/api/messages', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user || user.isBanned) return res.status(403).json("User banned");
        if (user.isMuted) return res.status(403).json("User muted");
        if (req.body.room === 'VIP Lounge' && !user.isVIP && !user.isAdmin) return res.status(402).json({ error: "VIP Membership Required" });

        let cleanText = req.body.text.replace(/<[^>]*>?/gm, '').trim();
        const msg = new Message({
            username: user.username,
            email: user.email,
            text: cleanText,
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
    } catch (err) { res.status(500).json({ error: "Server failed to save message" }); }
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
    } catch (err) { res.status(500).json({ error: "Support request failed" }); }
});

app.delete('/api/messages/:id', async (req, res) => {
    try {
        const adminEmail = req.query.adminEmail;
        const user = await User.findOne({ email: adminEmail });
        if (user && user.isAdmin) {
            await Message.findByIdAndDelete(req.params.id);
            res.json({ success: true });
        } else { res.status(403).json("Unauthorized"); }
    } catch (err) { res.status(500).json("Purge failed"); }
});

app.post('/api/update-profile', async (req, res) => {
    try {
        const { email, bio, status, avatar } = req.body;
        const updatedUser = await User.findOneAndUpdate({ email }, { bio, status, avatar }, { new: true });
        res.json(updatedUser);
    } catch (err) { res.status(500).json("Profile update failed"); }
});

app.get('/api/user-status', async (req, res) => {
    const user = await User.findOne({ email: req.query.email });
    if (!user) return res.status(404).json("User missing");
    res.json(user);
});

app.post('/api/register', async (req, res) => {
    try {
        const count = await User.countDocuments();
        const user = new User({ ...req.body, isAdmin: count === 0, isVIP: count === 0 });
        await user.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Registration failed" }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email, password: req.body.password });
        if (user && user.isBanned) return res.status(403).json("Account Banned");
        if (user) { res.json(user); } else { res.status(401).json("Invalid credentials"); }
    } catch (err) { res.status(500).json("Login error"); }
});

app.get('*', (req, res) => {
    const possiblePaths = [path.join(__dirname, 'index.html'), path.join(__dirname, 'public', 'index.html'), path.join(process.cwd(), 'index.html')];
    let found = false;
    for (let p of possiblePaths) { if (fs.existsSync(p)) { res.sendFile(p); found = true; break; } }
    if (!found) res.status(404).send(`<h1>404: Website Files Missing</h1>`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 SERVER RUNNING ON: ${PORT}`));