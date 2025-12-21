const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const mongoURI = "mongodb+srv://mojeauta123_db_user:Apple12345@cluster0.2k2jps5.mongodb.net/PokecDB?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log("☕ Connected Successfully"))
    .catch(err => console.log("❌ DB Error:", err));

// Stores user profile including the avatar
const User = mongoose.model('User', new mongoose.Schema({
    username: String, 
    email: { type: String, unique: true, required: true }, 
    password: String, 
    isAdmin: Boolean,
    avatar: { type: String, default: '👤' } 
}));

// Saves message with the corresponding room name
const Message = mongoose.model('Message', new mongoose.Schema({
    username: String, 
    email: String, 
    text: String, 
    room: String, 
    avatar: String, 
    timestamp: { type: Date, default: Date.now }
}));

app.get('/api/users', async (req, res) => res.json(await User.find()));

app.post('/api/ban', async (req, res) => {
    await User.findOneAndDelete({ email: req.body.email });
    await Message.deleteMany({ email: req.body.email });
    res.json({ success: true });
});

app.delete('/api/messages/:id', async (req, res) => {
    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true });
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
        avatar: user.avatar 
    });
    await msg.save();
    res.json(msg);
});

app.get('/api/user-status', async (req, res) => {
    const user = await User.findOne({ email: req.query.email });
    res.json({ isAdmin: user ? user.isAdmin : false });
});

// Register route with crash protection for duplicate emails
app.post('/api/register', async (req, res) => {
    try {
        const { email, username, password, avatar } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "Email already registered!" });
        }
        const count = await User.countDocuments();
        const user = new User({
            username, email, password, avatar: avatar || '👤', isAdmin: count === 0
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