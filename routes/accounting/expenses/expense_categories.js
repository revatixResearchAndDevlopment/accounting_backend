const express = require("express");
const app = express();
app.use(express.json());
const db = require("../../../config/db_config");

app
  .route("/")
  .get(async (req, res) => {
    try {
      await db.query("SET time_zone = '+05:30'");
      const { company_id } = req.query;

      if (!company_id) {
        return res.status(400).json({ success: false, message: "company_id is required" });
      }

      const sql = `SELECT * FROM expense_categories WHERE company_id = ? AND status = 'active' ORDER BY category_name ASC`;
      const [rows] = await db.query(sql, [parseInt(company_id)]);

      res.json({
        success: true,
        data: rows,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
  })
  .post(async (req, res) => {
    const { category_name, company_id } = req.body;

    if (!category_name || !company_id) {
      return res.status(400).json({ success: false, message: "category_name and company_id are required" });
    }

    try {
      const [result] = await db.query(
        "INSERT INTO expense_categories (category_name, company_id) VALUES (?, ?)",
        [category_name, company_id]
      );
      res.status(201).json({ success: true, message: "Category created", category_id: result.insertId });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })
  .put(async (req, res) => {
    const { category_id, ...updateFields } = req.body;
    if (!category_id) return res.status(400).json({ success: false, message: "category_id required" });

    try {
      const fields = Object.keys(updateFields);
      const setClause = fields.map((field) => `${field} = ?`).join(", ");
      const values = fields.map((field) => updateFields[field]);
      values.push(category_id);

      const [result] = await db.query(`UPDATE expense_categories SET ${setClause} WHERE category_id = ?`, values);
      res.json({ success: true, message: "Category updated" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }).delete(async (req, res) => {
    try {
      const { category_id } = req.body;

      if (!category_id) {
        return res.status(400).json({
          success: false,
          message: "category_id is required to delete.",
        });
      }

      const [result] = await db.query(
        "DELETE FROM expense_categories WHERE category_id = ?",
        [category_id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Category not found." });
      }

      res.json({ success: true, message: "Category Deleted Successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

module.exports = app;