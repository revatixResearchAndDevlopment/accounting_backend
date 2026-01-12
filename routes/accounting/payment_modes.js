const express = require("express");
const app = express();
app.use(express.json());
const db = require("../../config/db_config");

app
  .route("/")
  .get(async (req, res) => {
    try {
      await db.query("SET time_zone = '+05:30'");
      
      const sql = `SELECT * FROM payment_modes WHERE status = 'active' ORDER BY mode_name ASC`;
      const [rows] = await db.query(sql);

      res.json({
        success: true,
        data: rows,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
  })
  .post(async (req, res) => {
    const { mode_name } = req.body;

    if (!mode_name) {
      return res.status(400).json({ success: false, message: "mode_name is required" });
    }

    try {
      const [result] = await db.query("INSERT INTO payment_modes (mode_name) VALUES (?)", [mode_name]);
      res.status(201).json({ success: true, message: "Payment mode added", payment_mode_id: result.insertId });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }).put(async (req, res) => {
    const { payment_mode_id, ...updateFields } = req.body;

    if (!payment_mode_id) {
      return res.status(400).json({ success: false, message: "payment_mode_id is required" });
    }

    try {
      const fields = Object.keys(updateFields);
      if (fields.length === 0) {
        return res.status(400).json({ success: false, message: "No fields provided for update" });
      }

      const setClause = fields.map((field) => `${field} = ?`).join(", ");
      const values = fields.map((field) => updateFields[field]);
      values.push(payment_mode_id);

      const sql = `UPDATE payment_modes SET ${setClause} WHERE payment_mode_id = ?`;
      const [result] = await db.query(sql, values);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Payment mode not found" });
      }

      res.json({ success: true, message: "Payment mode updated successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })
  .delete(async (req, res) => {
    const { payment_mode_id } = req.body;
    try {
      await db.query("UPDATE payment_modes SET status = 'inactive' WHERE payment_mode_id = ?", [payment_mode_id]);
      res.json({ success: true, message: "Payment mode deactivated" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

module.exports = app;