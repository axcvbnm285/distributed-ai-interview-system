const express = require('express');
const cors = require('cors');
const prisma = require('./lib/prisma');

const app = express();
app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/routes');

app.use('/auth', authRoutes);
app.get('/', (req, res) => {
  res.send('Interview Platform API Running');
});

app.listen(3001, () => {
  console.log("Server running on port 3001");
});

