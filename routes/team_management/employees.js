const express= require("express");
const bcrypt = require("bcryptjs");
const app = express();
app.use(express.json());
const db = require("../../config/db_config")

app.route("/")
.get(
async (req,res)=>{
    try {

      await db.query("SET time_zone = '+05:30'");

        const { company_id } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 250; 
        const offset = (page - 1) * limit;

        if (!company_id) {
            return res.status(400).json({ success: false, message: "company_id is required" });
        }

        const dataSql = `
            SELECT 
                e.employee_id, e.name, e.email, e.designation, 
                e.joining_date, e.created_at, d.department_name
            FROM employees e
            INNER JOIN user_company_mapping ucm ON e.employee_id = ucm.employee_id
            LEFT JOIN departments d ON e.department_id = d.department_id
            WHERE ucm.company_id = ?
            ORDER BY e.employee_id DESC
            LIMIT ? OFFSET ?`;
       
        const [rows] = await db.query(dataSql, [parseInt(company_id), limit + 1, offset]);

        const hasMore = rows.length > limit;
        
        const dataToSend = hasMore ? rows.slice(0, limit) : rows;

        res.json({
            success: true,
            data: dataToSend,
            metadata: {
                currentPage: page,
                limit,
                hasMore: hasMore,
                recordsInChunk: dataToSend.length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message : "Internal server error",error: error.message });
    }
})
.post(async (req,res)=>{
    const { 
        name, 
        email, 
        password, 
        designation, 
        department_id, 
        joining_date, 
        company_id 
    } = req.body;

    // 1. Basic Validation
    if (!email || !company_id) {
        return res.status(400).json({ 
            success: false, 
            message: "Email and Company ID are required fields." 
        });
    }

    try {
        // Set IST for the session
        await db.query("SET time_zone = '+05:30'");

        // 2. Check if the employee email exists globally
        const [existingUser] = await db.query(
            "SELECT employee_id FROM employees WHERE email = ?", 
            [email]
        );
        
        let targetEmployeeId;

        if (existingUser.length > 0) {
            targetEmployeeId = existingUser[0].employee_id;

            // 3. Check if this specific user is already linked to the current company
            const [existingMapping] = await db.query(
                "SELECT * FROM user_company_mapping WHERE employee_id = ? AND company_id = ?",
                [targetEmployeeId, company_id]
            );

            if (existingMapping.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: "User already exists within this organization." 
                });
            }
        } else {
            // 4. Create new employee record if email is unique globally
            // Note: In a real world app, you'd hash the password here
            const [newUser] = await db.query(
                `INSERT INTO employees (name, email, password, designation, department_id, joining_date) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [name, email, password, designation, department_id, joining_date]
            );
            targetEmployeeId = newUser.insertId;
        }

        // 5. Create the mapping link to connect this employee to the company
        await db.query(
            "INSERT INTO user_company_mapping (employee_id, company_id) VALUES (?, ?)",
            [targetEmployeeId, company_id]
        );

        res.status(201).json({ 
            success: true, 
            message: "Employee successfully added and linked to company.",
            employee_id: targetEmployeeId 
        });

    } catch (error) {
        console.error("POST Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Internal Server Error",
            error: error.message 
        });
    }
})
.put(async (req,res)=>{
    const { employee_id, ...updateFields } = req.body; 
    
    if (!employee_id) {
        return res.status(400).json({ success: false, message: "employee_id is required" });
    }

    try {
        const fields = Object.keys(updateFields);
        if (fields.length === 0) {
            return res.status(400).json({ success: false, message: "No fields provided for update" });
        }

        // Build the dynamic SET string: "name = ?, designation = ?"
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const values = fields.map(field => updateFields[field]);
        
        // Add the employee_id for the WHERE clause at the end of the array
        values.push(employee_id);

        const sql = `UPDATE employees SET ${setClause} WHERE employee_id = ?`;
        
        const [result] = await db.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }

        res.json({ success: true, message: "Employee updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
})
.delete(async (req,res)=>{
    try {
        const { user_id } = req.body;
    try {
      await db.query("DELETE FROM employees WHERE user_id = ?", [user_id]);
      res.json({ success: true, message: "Employee Deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = app;   