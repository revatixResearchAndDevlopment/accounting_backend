const express = require("express");
const app = express();
const db = require("../../config/db_config");

app.use(express.json());

app.route("/")
  .get(async (req, res) => {
    try {
      const [rows] = await db.query("SELECT * FROM states ORDER BY state_name ASC");
      res.json({ success: true, data: rows });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  .post(async (req, res) => {
    try {
      const { state_id, state_name } = req.body;
      await db.query("INSERT INTO states (state_id, state_name) VALUES (?, ?)", [state_id, state_name]);
      res.status(201).json({ success: true, message: "State added" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  .put(async (req, res) => {
    try {
      const { state_id, state_name } = req.body;
      await db.query("UPDATE states SET state_name = ? WHERE state_id = ?", [state_name, state_id]);
      res.json({ success: true, message: "State updated" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  .delete(async (req, res) => {
    try {
      const { state_id } = req.body;
      await db.query("DELETE FROM states WHERE state_id = ?", [state_id]);
      res.json({ success: true, message: "State deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Cannot delete: State is linked to customers." });
    }
  });

module.exports = app;