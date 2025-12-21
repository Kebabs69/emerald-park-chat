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
mongoose.connect(mongoURI).then(() => console.log("☕ Connected Successfully")).catch(err => console.log("❌ DB Error:", err));

const User = mongoose.model('User', new mongoose.Schema({
    username: String, email: String, password: String, isAdmin: Boolean
}));

const Message = mongoose.model('Message', new mongoose.Schema({
    username: String, 
    email: String, 
    text: String, 
    room: String, 
    timestamp: { type: Date, default: Date.now }
}));

app.get('/api/users', async (req, res) => res.json(await User.find()));
app.post('/api/ban', async (req, res) => {
    await User.findOneAndDelete({ email: req.body.email });
    await Message.deleteMany({ email: req.body.email });
    res.json({ success: true });
});
app.delete('/api/messages/:id', async (req, res) => { await Message.findByIdAndDelete(req.params.id); res.json({ success: true }); });
app.post('/api/clear-chat', async (req, res) => { await Message.deleteMany({}); res.json({ success: true }); });
app.get('/api/messages', async (req, res) => res.json(await Message.find().sort({ timestamp: 1 })));

app.post('/api/messages', async (req, res) => {
    const userExists = await User.findOne({ email: req.body.email });
    if (!userExists) return res.status(403).json("Banned"); 

    // SAFETY FIRST: Remove any <scripts> or HTML tags
    let cleanText = req.body.text.replace(/<[^>]*>?/gm, '');
    
    const msg = new Message({
        ...req.body,
        text: cleanText
    });
    await msg.save();
    res.json(msg);
});

app.get('/api/user-status', async (req, res) => {
    const user = await User.findOne({ email: req.query.email });
    res.json({ isAdmin: user ? user.isAdmin : false });
});

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

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) res.sendFile(path.join(__dirname, 'index.html'));
    });
});

app.listen(10000, () => console.log("🚀 Server Live"));