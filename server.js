const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');

// --- DATABASE CONNECTION ---
// Use your Ramzzy user credentials here
const mongoURI = "mongodb+srv://Ramzzy:<password>@cluster0.xxxx.mongodb.net/BrewBound?retryWrites=true&w=majority"; 

mongoose.connect(mongoURI)
    .then(() => console.log("☕ Database Connected Successfully"))
    .catch(err => console.log("❌ Database Connection Error:", err));

// Database Schemas
const User = mongoose.model('User', { 
    email: { type: String, unique: true, required: true }, 
    password: { type: String, required: true },
    username: { type: String, required: true } 
});

const Message = mongoose.model('Message', { 
    user: String, 
    text: String, 
    timestamp: { type: Date, default: Date.now } 
});

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    let currentUser = null;

    // SEPARATE ACTION: REGISTER
    socket.on('register', async (data) => {
        try {
            const cleanEmail = data.email.toLowerCase().trim();
            const existing = await User.findOne({ email: cleanEmail });
            
            if (existing) {
                return socket.emit('auth error', 'This email is already registered. Please Login.');
            }
            
            const newUser = new User({ 
                email: cleanEmail, 
                password: data.password, 
                username: data.username 
            });
            await newUser.save();
            currentUser = data.username;
            socket.emit('auth success', { username: currentUser });
        } catch (err) {
            socket.emit('auth error', 'Registration failed. Try again.');
        }
    });

    // SEPARATE ACTION: LOGIN
    socket.on('login', async (data) => {
        try {
            const cleanEmail = data.email.toLowerCase().trim();
            const user = await User.findOne({ email: cleanEmail });
            
            if (user && user.password === data.password) {
                currentUser = user.username;
                socket.emit('auth success', { username: currentUser });
                // Send chat history
                const history = await Message.find().sort({ timestamp: -1 }).limit(50);
                socket.emit('load history', history.reverse());
            } else {
                socket.emit('auth error', 'Invalid email or password.');
            }
        } catch (err) {
            socket.emit('auth error', 'Login failed.');
        }
    });

    socket.on('chat message', async (data) => {
        if (!currentUser) return;
        const msg = new Message({ user: currentUser, text: data.text });
        await msg.save();
        io.emit('chat message', { user: currentUser, text: data.text });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server live on port ${PORT}`));