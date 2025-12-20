const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');

// --- THE FINAL FIX: Using Cluster ID 2k2jps5 ---
// Replace <db_password> with the password for mojeauta123_db_user
const mongoURI = "mongodb+srv://mojeauta123_db_user:ChatApp2025@cluster0.2k2jps5.mongodb.net/PokecDB?retryWrites=true&w=majority"; 

mongoose.connect(mongoURI)
    .then(() => console.log("☕ Database Connected Successfully"))
    .catch(err => console.log("❌ Database Connection Error:", err));

const User = mongoose.model('User', { 
    email: { type: String, unique: true }, 
    password: { type: String },
    username: { type: String },
    role: { type: String, default: 'customer' } 
});

const Message = mongoose.model('Message', { 
    user: String, 
    text: String, 
    timestamp: { type: Date, default: Date.now } 
});

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    let currentUser = null;
    let isAdmin = false;

    socket.on('register', async (data) => {
        try {
            const count = await User.countDocuments();
            const role = count === 0 ? 'admin' : 'customer';
            const user = new User({ ...data, role });
            await user.save();
            currentUser = user.username;
            isAdmin = (role === 'admin');
            socket.emit('auth success', { username: currentUser, isAdmin });
        } catch (e) { socket.emit('auth error', 'Email already exists.'); }
    });

    socket.on('login', async (data) => {
        const user = await User.findOne({ email: data.email, password: data.password });
        if (user) {
            currentUser = user.username;
            isAdmin = (user.role === 'admin');
            socket.emit('auth success', { username: currentUser, isAdmin });
            const history = await Message.find().sort({timestamp: -1}).limit(50);
            socket.emit('load history', history.reverse());
        } else {
            socket.emit('auth error', 'Wrong email or password.');
        }
    });

    socket.on('chat message', async (data) => {
        if (!currentUser) return;
        const msg = new Message({ user: currentUser, text: data.text });
        await msg.save();
        io.emit('chat message', { user: currentUser, text: data.text, id: msg._id });
    });

    socket.on('admin:get-users', async () => {
        if (!isAdmin) return;
        const users = await User.find({}, 'username email');
        socket.emit('admin:user-list', users);
    });

    socket.on('admin:delete-msg', async (id) => {
        if (!isAdmin) return;
        await Message.findByIdAndDelete(id);
        const history = await Message.find().sort({timestamp: -1}).limit(50);
        io.emit('load history', history.reverse());
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server live on ${PORT}`));