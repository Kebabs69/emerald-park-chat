const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// Connect to your MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Member Database Connected'))
    .catch(err => console.error('Connection Error:', err));

// Member Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true }
});

const MessageSchema = new mongoose.Schema({
    username: String,
    email: String,
    text: String,
    room: String,
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// AUTH ROUTE: This is what makes the "Enter" button work
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        // Check if user already exists
        let user = await User.findOne({ email });
        if (!user) {
            user = new User({ username, email, password });
            await user.save();
        }
        res.json(user);
    } catch (err) {
        res.status(400).json({ error: 'System Error' });
    }
});

app.get('/api/messages', async (req, res) => {
    const { room } = req.query;
    const msgs = await Message.find({ room }).sort({ timestamp: -1 }).limit(50);
    res.json(msgs.reverse());
});

app.post('/api/messages', async (req, res) => {
    const msg = new Message(req.body);
    await msg.save();
    res.json(msg);
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server Online on ${PORT}`));