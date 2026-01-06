

const express = require("express");
const app = express();
const db = require("../../config/db_config");

app.use(express.json());

app.route("/")
  .get(async (req, res) => {
    try {
      const { company_id } = req.query;
      // Using JOIN to get the Registration Type Name for the table view
      const sql = `
        SELECT c.*, r.registration_type_name 
        FROM customers c
        LEFT JOIN registration_type r ON c.registration_type_id = r.registration_type_id
        WHERE c.company_id = ?
        ORDER BY c.customer_name ASC`;
        
      const [rows] = await db.query(sql, [company_id]);
      res.json({ success: true, data: rows });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  .post(async (req, res) => {
    try {
      const data = req.body;
      // Ensure IDs are numbers
      data.company_id = Number(data.company_id);
      if(data.registration_type_id) data.registration_type_id = Number(data.registration_type_id);
      
      const [result] = await db.query("INSERT INTO customers SET ?", [data]);
      res.status(201).json({ success: true, insertId: result.insertId });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  .put(async (req, res) => {
    try {
      const { customer_id, registration_type_name, ...updateFields } = req.body;
      // We remove registration_type_name because it belongs to the other table
      
      await db.query("UPDATE customers SET ? WHERE customer_id = ?", [updateFields, customer_id]);
      res.json({ success: true, message: "Customer updated successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  .delete(async (req, res) => {
    try {
      const { customer_id } = req.body;
      await db.query("DELETE FROM customers WHERE customer_id = ?", [customer_id]);
      res.json({ success: true, message: "Customer deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error deleting customer. They might have existing invoices." });
    }
  });

module.exports = app;