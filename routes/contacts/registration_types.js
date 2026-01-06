const express = require("express");
const app = express();
const db = require("../../config/db_config");

app.use(express.json());

app.route("/")
  .get(async (req, res) => {
    try {
      const [rows] = await db.query("SELECT * FROM registration_type ORDER BY registration_type_id ASC");
      res.json({ success: true, data: rows });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })
  
  .post(async (req, res) => {
    try {
      const { registration_type_name } = req.body;
      const [result] = await db.query("INSERT INTO registration_type (registration_type_name) VALUES (?)", [registration_type_name]);
      res.status(201).json({ success: true, insertId: result.insertId });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  .put(async (req, res) => {
    try {
      const { registration_type_id, registration_type_name } = req.body;
      await db.query("UPDATE registration_type SET registration_type_name = ? WHERE registration_type_id = ?", 
        [registration_type_name, registration_type_id]);
      res.json({ success: true, message: "Registration type updated" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  .delete(async (req, res) => {
    try {
      const { registration_type_id } = req.body;
      // This will throw an error if a customer is still linked to this type (Foreign Key Protection)
      await db.query("DELETE FROM registration_type WHERE registration_type_id = ?", [registration_type_id]);
      res.json({ success: true, message: "Registration type deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Cannot delete: This type is currently assigned to customers." });
    }
  });

module.exports = app;