require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const {saveMessage} = require('./utils/utils');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 8000;

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
}));

app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO,
    collection: 'sessions',
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
  },
}));

// DATABASE CONNECTION
mongoose.connect(process.env.MONGO, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', () => console.log('Error in connecting to the database'));
db.once('open', () => console.log('Connected to the Database'));

// Import routes and configuration
const authRoutes = require('./routes/auth')(db);
const layoutRoutes = require('./routes/layout')(db);
const marketplaceRoutes = require('./routes/marketplace')(db);
const profileRoutes = require('./routes/profile')(db);
const chatRoutes = require('./routes/chat');

app.use('/api/auth', authRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/layout', layoutRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/chat', chatRoutes);

io.on('connection', (socket) => {
  console.log('Un utilisateur s\'est connecté');

  socket.on('join room', ({ to, from }) => {
    const roomName = [to, from].sort().join('+');
    socket.join(roomName);
    console.log(`A user joined room: ${roomName}`);
  });

  socket.on('private message', async (message) => {
    const { to, from } = message;
    const roomName = [to, from].sort().join('+');
    io.to(roomName).emit('private message', message);
    await saveMessage(message);
    console.log('Message privé reçu', message);
  });

  socket.on('disconnect', () => {
    console.log('Un utilisateur s\'est déconnecté');
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
