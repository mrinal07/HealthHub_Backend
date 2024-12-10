const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    name: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true }
    },  
    authProvider: { type: String, default: 'Google' },
    roles: { type: [String], default: ['user'] },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
