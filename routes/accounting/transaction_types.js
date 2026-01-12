const express = require("express");
const app = express();
app.use(express.json());
const db = require("../../config/db_config");

app
  .route("/")
  // 1. GET - Fetch all transaction types (Credit, Debit, etc.)
  .get(async (req, res) => {
    try {
      const [rows] = await db.query(
        "SELECT * FROM transaction_types ORDER BY transaction_type_id ASC"
      );
      res.json({
        success: true,
        data: rows,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  // 2. POST - Create a new transaction type
  .post(async (req, res) => {
    const { transaction_type_name } = req.body;

    if (!transaction_type_name) {
      return res.status(400).json({
        success: false,
        message: "transaction_type_name is required",
      });
    }

    try {
      const [result] = await db.query(
        "INSERT INTO transaction_types (transaction_type_name) VALUES (?)",
        [transaction_type_name]
      );
      res.status(201).json({
        success: true,
        message: "Transaction type created successfully",
        id: result.insertId,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  // 3. PUT - Update an existing transaction type
  .put(async (req, res) => {
    const { transaction_type_id, transaction_type_name } = req.body;

    if (!transaction_type_id || !transaction_type_name) {
      return res.status(400).json({
        success: false,
        message: "ID and Name are required for update",
      });
    }

    try {
      const [result] = await db.query(
        "UPDATE transaction_types SET transaction_type_name = ? WHERE transaction_type_id = ?",
        [transaction_type_name, transaction_type_id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Type not found" });
      }

      res.json({ success: true, message: "Transaction type updated" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  // 4. DELETE - Remove a transaction type
  .delete(async (req, res) => {
    const { transaction_type_id } = req.body;

    if (!transaction_type_id) {
      return res.status(400).json({
        success: false,
        message: "transaction_type_id is required",
      });
    }

    try {
      // Note: This will fail if the ID is being used in the expenses table (Foreign Key constraint)
      const [result] = await db.query(
        "DELETE FROM transaction_types WHERE transaction_type_id = ?",
        [transaction_type_id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Type not found" });
      }

      res.json({ success: true, message: "Transaction type deleted" });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Cannot delete: This type is likely assigned to existing expenses.",
        error: error.message 
      });
    }
  });

module.exports = app;