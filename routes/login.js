const express = require('express');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());
const db = require('../config/db_config');

app.post("/",async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    
    try {
        const [result] = await db.query('SELECT * FROM employees WHERE email = ? ', [email]);
        if (result.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        const user = result[0];
        const pass_check = await bcrypt.compare(password, user.password);
        if (!pass_check) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        return res.status(200).json({success: true, message: 'Login successful',  id: user.user_id, email: user.email , name : user.name });
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = app;