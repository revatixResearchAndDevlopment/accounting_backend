const express = require("express");
const app = express();
app.use(express.json());
const db = require("../../../config/db_config");

app
  .route("/")
  .get(async (req, res) => {
    try {
      // Set IST Timezone as per your reference
      await db.query("SET time_zone = '+05:30'");

      const { company_id } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 250;
      const offset = (page - 1) * limit;

      if (!company_id) {
        return res
          .status(400)
          .json({ success: false, message: "company_id is required" });
      }

      // Count query for total records
      const [countResult] = await db.query(
        "SELECT COUNT(*) as total FROM expenses WHERE company_id = ?",
        [parseInt(company_id)]
      );
      const totalRecords = countResult[0].total;

      // Data query with Joins for robust reporting
      const dataSql = `
            SELECT 
                e.*, 
                ec.category_name, 
                pm.mode_name, 
                emp.name as recorded_by_name,
                d.department_name
            FROM expenses e
            INNER JOIN expense_categories ec ON e.category_id = ec.category_id
            INNER JOIN payment_modes pm ON e.payment_mode_id = pm.payment_mode_id
            INNER JOIN employees emp ON e.employee_id = emp.employee_id
            LEFT JOIN department d ON e.department_id = d.department_id
            WHERE e.company_id = ?
            ORDER BY e.expense_id DESC
            LIMIT ? OFFSET ?`;

      const [rows] = await db.query(dataSql, [
        parseInt(company_id),
        limit + 1,
        offset,
      ]);

      const hasMore = rows.length > limit;
      const dataToSend = hasMore ? rows.slice(0, limit) : rows;

      res.json({
        success: true,
        metadata: {
          currentPage: page,
          limit,
          hasMore: hasMore,
          totalCount: totalRecords,
          totalPages: Math.ceil(totalRecords / limit),
          recordsInChunk: dataToSend.length,
        },
        data: dataToSend,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  })
  .post(async (req, res) => {
    const {
      company_id,
      employee_id,
      department_id,
      category_id,
      payment_mode_id,
      transaction_type_id,
      expense_date,
      vendor_name,
      amount,
      reference_number,
      description
    } = req.body;

    // 1. Mandatory Fields Validation
    if (!company_id || !employee_id || !category_id || !payment_mode_id || !amount || !expense_date) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: company_id, employee_id, category, payment mode, date, and amount are mandatory.",
      });
    }

    try {
      await db.query("SET time_zone = '+05:30'");

      const sql = `INSERT INTO expenses 
        (company_id, employee_id, department_id, category_id, payment_mode_id, transaction_type_id, expense_date, vendor_name, amount, reference_number, description, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

      const [result] = await db.query(sql, [
        company_id,
        employee_id,
        department_id,
        category_id,
        payment_mode_id,
        transaction_type_id || 2, // Default to 2 if not provided
        expense_date,
        vendor_name,
        amount,
        reference_number,
        description
      ]);

      res.status(201).json({
        success: true,
        message: "Expense recorded successfully.",
        expense_id: result.insertId,
      });
    } catch (error) {
      console.error("POST Error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  })
  .put(async (req, res) => {
    const { expense_id, ...updateFields } = req.body;

    if (!expense_id) {
      return res
        .status(400)
        .json({ success: false, message: "expense_id is required" });
    }

    try {
      const fields = Object.keys(updateFields);
      if (fields.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No fields provided for update" });
      }

      const setClause = fields.map((field) => `${field} = ?`).join(", ");
      const values = fields.map((field) => updateFields[field]);
      values.push(expense_id);

      const sql = `UPDATE expenses SET ${setClause} WHERE expense_id = ?`;

      const [result] = await db.query(sql, values);

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Expense record not found" });
      }

      res.json({ success: true, message: "Expense updated successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })
  .delete(async (req, res) => {
    try {
      const { expense_id } = req.body;

      if (!expense_id) {
        return res.status(400).json({
          success: false,
          message: "expense_id is required to delete.",
        });
      }

      const [result] = await db.query(
        "DELETE FROM expenses WHERE expense_id = ?",
        [expense_id]
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Expense record not found." });
      }

      res.json({ success: true, message: "Expense Deleted" });
    } catch (error) {
      console.error("DELETE Error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

module.exports = app;