const express = require("express");
const app = express();
app.use(express.json());
const db = require("../../config/db_config");

app.route("/")
  .get(async (req, res) => {
    try {
      const { company_id } = req.query;
      // Fetch both global units (company_id is null) and company-specific units
      const sql = "SELECT * FROM uqc_units WHERE company_id IS NULL OR company_id = ? ORDER BY unit_name ASC";
      const [rows] = await db.query(sql, [company_id]);
      res.json({ success: true, data: rows });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  .post(async (req, res) => {
    const { unit_code, unit_name, company_id } = req.body;
    if (!unit_code || !unit_name) {
      return res.status(400).json({ success: false, message: "Unit code and name are required." });
    }
    try {
      const [result] = await db.query(
        "INSERT INTO uqc_units (unit_code, unit_name, company_id) VALUES (?, ?, ?)",
        [unit_code.toUpperCase(), unit_name.toUpperCase(), company_id]
      );
      res.status(201).json({ success: true, insertId: result.insertId });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  .put(async (req, res) => {
    const { uqc_id, ...updateFields } = req.body;
    if (!uqc_id) return res.status(400).json({ success: false, message: "uqc_id is required" });

    try {
      const fields = Object.keys(updateFields);
      const setClause = fields.map((field) => `${field} = ?`).join(", ");
      const values = fields.map((field) => updateFields[field]);
      values.push(uqc_id);

      await db.query(`UPDATE uqc_units SET ${setClause} WHERE uqc_id = ?`, values);
      res.json({ success: true, message: "Unit updated" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  .delete(async (req, res) => {
    const { uqc_id } = req.body;
    try {
      // Note: This will fail if a product is currently using this unit (RESTRICT)
      const [result] = await db.query("DELETE FROM uqc_units WHERE uqc_id = ?", [uqc_id]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Unit not found" });
      res.json({ success: true, message: "Unit deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Cannot delete unit; it is currently linked to products." });
    }
  });

module.exports = app;