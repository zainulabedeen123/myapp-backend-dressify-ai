const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const Stripe = require('stripe');
require('dotenv').config();

// Initialize Express App
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// MongoDB Connection String from MongoDB Atlas
const mongoURI = 'mongodb+srv://zainulabedeen188:RPyTw7b36PRB2bnn@dressifytechaistylist.ntphv.mongodb.net/?retryWrites=true&w=majority&appName=DressifyTechAIStylist';

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB Connected'))
    .catch((err) => console.log(err));

// Define User Schema and Model for credit tracking
const userSchema = new mongoose.Schema({
    googleId: String,
    email: String,
    credits: { type: Number, default: 10 },
    extraCredits: { type: Number, default: 0 },  // Extra credits purchased
    stripeCustomerId: String, // Store Stripe customer ID for subscriptions
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

    if (user && (user.credits > 0 || user.extraCredits > 0)) {
        if (user.credits > 0) {
            user.credits -= 1;
        } else if (user.extraCredits > 0) {
            user.extraCredits -= 1;
        }
        await user.save();
        res.json({ success: true, credits: user.credits, extraCredits: user.extraCredits });
    } else {
        res.status(400).json({ success: false, message: 'Not enough credits' });
    }
});

// Stripe API for creating a customer and subscription
app.post('/api/create-subscription', async (req, res) => {
    const { email, paymentMethodId, planId, googleId } = req.body;

    try {
        // Find user by Google ID
        let user = await User.findOne({ googleId });

        // Create a new customer in Stripe if not already exists
        let customer;
        if (!user.stripeCustomerId) {
            customer = await stripe.customers.create({
                email,
                payment_method: paymentMethodId,
                invoice_settings: { default_payment_method: paymentMethodId },
            });
            user.stripeCustomerId = customer.id;
            await user.save();
        } else {
            customer = await stripe.customers.retrieve(user.stripeCustomerId);
        }

        // Plan IDs for subscriptions
        let priceId;
        if (planId === '100_credits') {
            priceId = 'price_1PxO48GI6vk81n8VDNbPRDUv';
        } else if (planId === '1000_credits') {
            priceId = 'price_1PxOY5GI6vk81n8VHEdhYfwI';
        } else if (planId === '20000_credits') {
            priceId = 'price_1PxW4wGI6vk81n8VOVrsM7oY'; // Annual plan
        }

        // Create the subscription
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: priceId }],
            expand: ['latest_invoice.payment_intent'],
        });

        res.send({
            subscriptionId: subscription.id,
            clientSecret: subscription.latest_invoice.payment_intent.client_secret,
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// API for purchasing extra credits
app.post('/api/purchase-credits', async (req, res) => {
    const { email, paymentMethodId, creditAmount, googleId } = req.body;

    // Set Stripe price ID based on selected credits
    let priceId;
    if (creditAmount === 30) {
        priceId = 'price_1PxOOWGI6vk81n8VhTmVwBs'; // Price ID for 30 credits
    } else if (creditAmount === 70) {
        priceId = 'price_1PxOP3GI6vk81n8V5MA34kv'; // Price ID for 70 credits
    } else if (creditAmount === 5000) {
        priceId = 'price_1PxOPqGI6vk81n8V9o09e41'; // Price ID for 5000 credits
    }

    try {
        // Find the user in the database
        const user = await User.findOne({ googleId });

        if (!user.stripeCustomerId) {
            // Create a new customer in Stripe if not already exists
            const customer = await stripe.customers.create({
                email,
                payment_method: paymentMethodId,
                invoice_settings: { default_payment_method: paymentMethodId },
            });
            user.stripeCustomerId = customer.id;
            await user.save();
        }

        // Create a payment intent for purchasing extra credits
        const paymentIntent = await stripe.paymentIntents.create({
            amount: priceId, // The correct amount for selected credits
            currency: 'usd',
            payment_method: paymentMethodId,
            confirmation_method: 'manual',
            confirm: true,
        });

        // Update the user's extra credits after successful payment
        user.extraCredits += creditAmount;
        await user.save();

        res.send({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// API to reset credits (called during subscription renewal)
app.post('/api/reset-credits', async (req, res) => {
    const { googleId, monthlyCredits } = req.body;

    try {
        const user = await User.findOne({ googleId });

        // Add any extra credits to the new monthly credits
        const totalCredits = user.extraCredits + monthlyCredits;

        // Reset extra credits to 0 after adding to total credits
        user.credits = totalCredits;
        user.extraCredits = 0;
        await user.save();

        res.send({ success: true, credits: user.credits });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

