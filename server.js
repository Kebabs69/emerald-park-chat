const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// SECURITY: Uses Render's Environment Variable
const mongoURI = process.env.MONGO_URI; 

mongoose.connect(mongoURI)
    .then(() => console.log("☕ Connected Successfully"))
    .catch(err => console.log("❌ DB Error:", err));

// UPDATED SCHEMA: Added isVIP to track paying users
const User = mongoose.model('User', new mongoose.Schema({
    username: String, 
    email: { type: String, unique: true, required: true }, 
    password: String, 
    isAdmin: Boolean,
    isVIP: { type: Boolean, default: false }, 
    avatar: { type: String, default: '👤' } 
}));

// UPDATED SCHEMA: Messages store if sender is Admin or VIP
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

app.get('/api/users', async (req, res) => res.json(await User.find()));

app.post('/api/ban', async (req, res) => {
    await User.findOneAndDelete({ email: req.body.email });
    await Message.deleteMany({ email: req.body.email });
    res.json({ success: true });
});

// UPDATED: Added security check to ensure only admins can delete messages
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
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

app.post('/api/clear-chat', async (req, res) => {
    await Message.deleteMany({});
    res.json({ success: true });
});

app.get('/api/messages', async (req, res) => res.json(await Message.find().sort({ timestamp: 1 })));

app.post('/api/messages', async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(403).json("Banned"); 

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
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "Email already registered!" });
        }
        const count = await User.countDocuments();
        const user = new User({
            username, email, password, avatar: avatar || '👤', isAdmin: count === 0, isVIP: false
        });
        await user.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

app.post('/api/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password });
    user ? res.json(user) : res.status(401).json("Fail");
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) res.sendFile(path.join(__dirname, 'index.html'));
    });
});

app.listen(10000, () => console.log("🚀 Server Live"));