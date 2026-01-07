const express = require("express");
const app = express();
const db = require("../../config/db_config");

app.use(express.json());

app.route("/")
  .get(async (req, res) => {
    try {
      const [rows] = await db.query("SELECT * FROM source_types ORDER BY source_type_id ASC");
      res.json({ success: true, data: rows });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  .post(async (req, res) => {
    try {
      const { source_type_name } = req.body;
      const [result] = await db.query("INSERT INTO source_types (source_type_name) VALUES (?)", [source_type_name]);
      res.status(201).json({ success: true, insertId: result.insertId });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  .put(async (req, res) => {
    try {
      const { source_type_id, source_type_name } = req.body;
      await db.query("UPDATE source_types SET source_type_name = ? WHERE source_type_id = ?", 
        [source_type_name, source_type_id]);
      res.json({ success: true, message: "Type updated successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  .delete(async (req, res) => {
    try {
      const { source_type_id } = req.body;
      await db.query("DELETE FROM source_types WHERE source_type_id = ?", [source_type_id]);
      res.json({ success: true, message: "Type deleted successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Cannot delete: This type is linked to existing logs." });
    }
  });

module.exports = app;