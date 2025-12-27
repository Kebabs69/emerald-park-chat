const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // Essential for security

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// Use the ENV variable we created in Step 1
const mongoURI = process.env.MONGO_URI; 

mongoose.connect(mongoURI)
    .then(() => console.log("💎 Database Securely Connected"))
    .catch(err => console.error("❌ DB Error:", err));

// Models stay the same so you don't lose data
const User = mongoose.model('User', new mongoose.Schema({
    username: String, email: String, password: String, isAdmin: Boolean
}));

const Message = mongoose.model('Message', new mongoose.Schema({
    username: String, email: String, text: String, room: String,
    timestamp: { type: Date, default: Date.now }
}));

// API Routes
app.get('/api/messages', async (req, res) => {
    const msgs = await Message.find().sort({ timestamp: 1 }).limit(100);
    res.json(msgs);
});

app.post('/api/messages', async (req, res) => {
    // Basic Sanitization to keep it professional
    const cleanText = req.body.text.replace(/<[^>]*>?/gm, ''); 
    const msg = new Message({ ...req.body, text: cleanText });
    await msg.save();
    res.json(msg);
});

app.post('/api/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password });
    if (user) res.json(user);
    else res.status(401).json("Auth Failed");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Elite Server running on port ${PORT}`));