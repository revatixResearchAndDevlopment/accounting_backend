const express = require('express');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());
const db = require('../config/db_config');

app.post("/",async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    
    try {
        const [result] = await db.query('SELECT * FROM users WHERE username = ? ', [username]);
        if (result.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        const user = result[0];
        const pass_check = await bcrypt.compare(password, user.password);
        if (!pass_check) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        return res.status(200).json({ message: 'Login successful',  id: user.user_id, username: user.username , name : user.name });
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = app;