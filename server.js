const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Absolute path fix for Render
const publicPath = path.resolve(__dirname);
app.use(express.static(publicPath));

const mongoURI = process.env.MONGO_URI; 

mongoose.connect(mongoURI)
    .then(() => console.log("☕ Connected Successfully"))
    .catch(err => console.log("❌ DB Error:", err));

const User = mongoose.model('User', new mongoose.Schema({
    username: String, 
    email: { type: String, unique: true, required: true }, 
    password: String, 
    isAdmin: { type: Boolean, default: false },
    isVIP: { type: Boolean, default: false }, 
    avatar: { type: String, default: '👤' } 
}));

const Message = mongoose.model('Message', new mongoose.Schema({
    username: String, 
    email: String, 
    text: String, 
    room: String, 
    avatar: String, 
    isAdmin: Boolean,
    isVIP: Boolean,
    timestamp: { type: Date, default: Date.now }
}));

app.delete('/api/messages/:id', async (req, res) => {
    try {
        const adminEmail = req.query.adminEmail;
        const user = await User.findOne({ email: adminEmail });
        if (user && user.isAdmin) {
            await Message.findByIdAndDelete(req.params.id);
            res.json({ success: true });
        } else {
            res.status(403).json({ error: "Unauthorized" });
        }
    } catch (err) { res.status(500).json(err); }
});

app.get('/api/messages', async (req, res) => {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
});

app.post('/api/messages', async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(403).json("User not found");
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
    res.json({ 
        isAdmin: user ? user.isAdmin : false,
        isVIP: user ? user.isVIP : false 
    });
});

app.post('/api/register', async (req, res) => {
    try {
        const { email, username, password, avatar } = req.body;
        const count = await User.countDocuments();
        const user = new User({
            username, email, password, avatar: avatar || '👤', isAdmin: count === 0, isVIP: false
        });
        await user.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password });
    user ? res.json(user) : res.status(401).json("Fail");
});

// Root route fix: Explicitly serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server Live on port ${PORT}`));