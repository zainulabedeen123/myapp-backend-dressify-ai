const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

// Initialize Express App
const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection String from MongoDB Atlas
const mongoURI = 'mongodb+srv://zainulabedeen188:RPyTw7b36PRB2bnn@dressifytechaistylist.ntphv.mongodb.net/?retryWrites=true&w=majority&appName=DressifyTechAIStylist'; // Replace with your MongoDB Atlas connection string

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB Connected'))
    .catch((err) => console.log(err));

// Define User Schema and Model for credit tracking
const userSchema = new mongoose.Schema({
    googleId: String,
    email: String,
    credits: { type: Number, default: 10 },
});

const User = mongoose.model('User', userSchema);

// API to get user data by Google ID
app.get('/api/user/:id', async (req, res) => {
    const user = await User.findOne({ googleId: req.params.id });
    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ message: 'User not found' });
    }
});

// API to deduct 1 credit
app.post('/api/user/deduct', async (req, res) => {
    const { googleId } = req.body;
    const user = await User.findOne({ googleId });

    if (user && user.credits > 0) {
        user.credits -= 1;
        await user.save();
        res.json({ success: true, credits: user.credits });
    } else {
        res.status(400).json({ success: false, message: 'Not enough credits' });
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
 
