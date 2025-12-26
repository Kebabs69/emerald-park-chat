const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(cors());

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadDir));

const mongoURI = process.env.MONGO_URI; 

mongoose.connect(mongoURI)
    .then(() => console.log("☕ Database Connected Successfully"))
    .catch(err => console.log("❌ DB Error:", err));

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

// --- API ROUTES ---

// 1. ADDED: This is needed to get the online users
app.get('/api/online-users', async (req, res) => {
    try {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
        const onlineUsers = await User.find({ lastSeen: { $gte: fiveMinsAgo } }).select('username avatar');
        res.json(onlineUsers);
    } catch (err) { res.status(500).json([]); }
});

app.get('/api/messages', async (req, res) => {
    try {
        const { room, userEmail } = req.query;
        if (userEmail) {
            await User.findOneAndUpdate({ email: userEmail }, { lastSeen: Date.now() });
        }
        let query = {};
        if (room === 'DM') {
            query = { room: 'DM', $or: [{ email: userEmail }, { recipientEmail: userEmail }] };
        } else if (room) {
            query.room = room;
        }
        const messages = await Message.find(query).sort({ timestamp: 1 }).limit(50);
        res.json(messages);
    } catch (err) { res.status(500).json([]); }
});

// 2. ADDED: The missing Delete route for Admins
app.delete('/api/messages/:id', async (req, res) => {
    try {
        const adminUser = await User.findOne({ email: req.query.adminEmail });
        if (adminUser && adminUser.isAdmin) {
            await Message.findByIdAndDelete(req.params.id);
            res.json({ success: true });
        } else {
            res.status(403).json("Unauthorized");
        }
    } catch (err) { res.status(500).json("Delete failed"); }
});

app.post('/api/messages', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user || user.isBanned) return res.status(403).json("Access Denied");
        const msg = new Message({ ...req.body, isAdmin: user.isAdmin, isVIP: user.isVIP });
        await msg.save();
        res.json(msg);
    } catch (err) { res.status(500).json("Error"); }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    res.json({ url: `/uploads/${req.file.filename}` });
});

app.post('/api/admin/action', async (req, res) => {
    const { adminEmail, targetEmail, action } = req.body;
    const admin = await User.findOne({ email: adminEmail });
    if (!admin || !admin.isAdmin) return res.status(403).json("Access Denied");
    
    if (action === 'ban') await User.findOneAndUpdate({ email: targetEmail }, { isBanned: true });
    if (action === 'unban') await User.findOneAndUpdate({ email: targetEmail }, { isBanned: false });
    if (action === 'vip') await User.findOneAndUpdate({ email: targetEmail }, { isVIP: true });
    res.json({ success: true });
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

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));