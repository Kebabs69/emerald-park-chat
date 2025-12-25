const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());

// Serves all static files (CSS, JS, Images) from the main folder
app.use(express.static(__dirname));

const mongoURI = process.env.MONGO_URI; 

mongoose.connect(mongoURI)
    .then(() => console.log("☕ Database Connected Successfully"))
    .catch(err => console.log("❌ DB Error:", err));

// Keep your Models exactly as they are
const User = mongoose.model('User', new mongoose.Schema({
    username: String, 
    email: { type: String, unique: true, required: true }, 
    password: String, 
    isAdmin: { type: Boolean, default: false },
    isVIP: { type: Boolean, default: false }, 
    avatar: { type: String, default: '👤' } 
}));

const Message = mongoose.model('Message', new mongoose.Schema({
    username: String, email: String, text: String, room: String, 
    avatar: String, isAdmin: Boolean, isVIP: Boolean,
    timestamp: { type: Date, default: Date.now }
}));

// API Routes
app.get('/api/messages', async (req, res) => {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
});

app.post('/api/messages', async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(403).json("User not found");
    
    // VIP Lounge Protection
    if (req.body.room === 'VIP Lounge' && !user.isVIP && !user.isAdmin) {
        return res.status(402).json({ error: "Payment Required" });
    }

    // Security: Remove any HTML tags from the message
    let cleanText = req.body.text.replace(/<[^>]*>?/gm, '');

    const msg = new Message({
        ...req.body,
        text: cleanText,
        avatar: user.avatar,
        isAdmin: user.isAdmin,
        isVIP: user.isVIP
    });
    await msg.save();
    res.json(msg);
});

app.get('/api/user-status', async (req, res) => {
    const user = await User.findOne({ email: req.query.email });
    res.json({ isAdmin: user ? user.isAdmin : false, isVIP: user ? user.isVIP : false });
});

app.post('/api/register', async (req, res) => {
    try {
        const count = await User.countDocuments();
        const user = new User({ ...req.body, isAdmin: count === 0, isVIP: false });
        await user.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Registration failed" }); }
});

app.post('/api/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password });
    user ? res.json(user) : res.status(401).json("Fail");
});

// CRITICAL FIX FOR RENDER: The "Universal Path" solution
app.get('*', (req, res) => {
    const mainPath = path.join(__dirname, 'index.html');
    const publicPath = path.join(__dirname, 'public', 'index.html');
    
    if (fs.existsSync(mainPath)) return res.sendFile(mainPath);
    if (fs.existsSync(publicPath)) return res.sendFile(publicPath);
    
    res.status(404).send("index.html not found in root or public folder");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));