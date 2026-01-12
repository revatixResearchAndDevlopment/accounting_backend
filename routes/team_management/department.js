const express = require('express');
const app = express();
const db = require('../config/db');
app.use(express.json());


app._router('/').get( async (req, res) => {
    try {
        const { company_id } = req.query;
        const [rows] = await db.query(
            'SELECT * FROM department WHERE company_id = ? ORDER BY department_name ASC', 
            [company_id]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}).post( async (req, res) => {
    try {
        const { department_name, company_id } = req.body;
        const [result] = await db.query(
            'INSERT INTO department (department_name, company_id) VALUES (?, ?)',
            [department_name, company_id]
        );
        res.json({ success: true, id: result.insertId, message: "Department created" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}).put( async (req, res) => {
    try {
        const { id } = req.params;
        const { department_name } = req.body;
        await db.query(
            'UPDATE department SET department_name = ? WHERE department_id = ?',
            [department_name, id]
        );
        res.json({ success: true, message: "Department updated" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}).delete( async (req, res) => {
    try {
        const { id } = req.params;
        // Note: You might want to check if expenses are linked before deleting
        await db.query('DELETE FROM department WHERE department_id = ?', [id]);
        res.json({ success: true, message: "Department deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Cannot delete department while linked to expenses" });
    }
});

module.exports = router;