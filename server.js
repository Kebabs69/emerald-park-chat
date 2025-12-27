const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("💎 Civility DB Connected"))
    .catch(err => console.log("❌ Connection Error:", err));

// Database Schemas (Keeping your existing structure)
const User = mongoose.model('User', new mongoose.Schema({
    username: String, email: { type: String, unique: true }, password: String,
    avatar: { type: String, default: '👤' }, isAdmin: { type: Boolean, default: false },
    isVIP: { type: Boolean, default: false }, lastSeen: { type: Date, default: Date.now }
}));

const Message = mongoose.model('Message', new mongoose.Schema({
    username: String, email: String, text: String, room: String, 
    avatar: String, isAdmin: Boolean, isVIP: Boolean, timestamp: { type: Date, default: Date.now }
}));

// API Routes
app.post('/api/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password });
    if (user) {
        await User.updateOne({ email: user.email }, { lastSeen: Date.now() });
        res.json(user);
    } else res.status(401).send("Fail");
});

app.post('/api/register', async (req, res) => {
    try {
        const count = await User.countDocuments();
        const user = new User({ ...req.body, isAdmin: count === 0, isVIP: count === 0 });
        await user.save();
        res.json(user);
    } catch (e) { res.status(400).send("Error"); }
});

app.get('/api/messages', async (req, res) => {
    const msgs = await Message.find({ room: req.query.room }).sort({ timestamp: 1 }).limit(50);
    res.json(msgs);
});

app.post('/api/messages', async (req, res) => {
    const cleanText = req.body.text.replace(/<[^>]*>?/gm, '');
    const msg = new Message({ ...req.body, text: cleanText });
    await msg.save();
    res.json(msg);
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Civility running on ${PORT}`));