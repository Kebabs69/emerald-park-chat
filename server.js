const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ⚠️ REPLACE THE PASSWORD BELOW WITH YOUR ACTUAL MONGODB PASSWORD
const mongoURI = "mongodb+srv://mojeauta123_db_user:Apple12345@cluster0.2k2jps5.mongodb.net/PokecDB?retryWrites=true&w=majority";

mongoose.connect(mongoURI).then(() => console.log("☕ Connected")).catch(err => console.log(err));

const User = mongoose.model('User', new mongoose.Schema({
    username: String, email: String, password: String, isAdmin: Boolean
}));

const Message = mongoose.model('Message', new mongoose.Schema({
    username: String, email: String, text: String, timestamp: { type: Date, default: Date.now }
}));

// Admin Routes
app.get('/api/users', async (req, res) => res.json(await User.find()));

app.post('/api/ban', async (req, res) => {
    const { email } = req.body;
    await User.findOneAndDelete({ email });
    await Message.deleteMany({ email });
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

// Regular Routes
app.get('/api/messages', async (req, res) => res.json(await Message.find().sort({ timestamp: 1 })));

app.post('/api/messages', async (req, res) => {
    const msg = new Message(req.body);
    await msg.save();
    res.json(msg);
});

app.get('/api/user-status', async (req, res) => {
    const user = await User.findOne({ email: req.query.email });
    res.json({ isAdmin: user ? user.isAdmin : false });
});

// Login/Register Logic
app.post('/api/register', async (req, res) => {
    const count = await User.countDocuments();
    const user = new User({...req.body, isAdmin: count === 0});
    await user.save();
    res.json(user);
});

app.post('/api/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password });
    user ? res.json(user) : res.status(401).json("Fail");
});

app.listen(10000, () => console.log("Server Live"));