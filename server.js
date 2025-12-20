const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serves the HTML and CSS files from the current folder
app.use(express.static(__dirname));

let messageHistory = []; 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    // Send message history to the new user immediately
    socket.emit('load history', messageHistory);

    socket.on('chat message', (data) => {
        messageHistory.push(data);
        // Keep the history at 50 messages to save memory
        if (messageHistory.length > 50) messageHistory.shift();
        
        io.emit('chat message', data);
    });
});

// Render sets the PORT environment variable automatically
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});