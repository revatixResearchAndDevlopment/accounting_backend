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
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 250;
      const offset = (page - 1) * limit;

      if (!company_id) {
        return res.status(400).json({ success: false, message: "company_id is required" });
      }

      const [countResult] = await db.query("SELECT COUNT(*) as total FROM expenses WHERE company_id = ?", [parseInt(company_id)]);
      const totalRecords = countResult[0].total;

      // ADDED: tt.transaction_type_name to fix the empty Type column
      const dataSql = `
            SELECT 
                e.*, ec.category_name, pm.mode_name, 
                emp.name as recorded_by_name, d.department_name,
                tt.transaction_type_name
            FROM expenses e
            INNER JOIN expense_categories ec ON e.category_id = ec.category_id
            INNER JOIN payment_modes pm ON e.payment_mode_id = pm.payment_mode_id
            INNER JOIN employees emp ON e.employee_id = emp.employee_id
            LEFT JOIN department d ON e.department_id = d.department_id
            LEFT JOIN transaction_types tt ON e.transaction_type_id = tt.transaction_type_id
            WHERE e.company_id = ?
            ORDER BY e.expense_id DESC
            LIMIT ? OFFSET ?`;

      const [rows] = await db.query(dataSql, [parseInt(company_id), limit + 1, offset]);
      const hasMore = rows.length > limit;
      const dataToSend = hasMore ? rows.slice(0, limit) : rows;

      res.json({
        success: true,
        metadata: {
          currentPage: page,
          limit,
          hasMore,
          totalCount: totalRecords,
          totalPages: Math.ceil(totalRecords / limit),
        },
        data: dataToSend,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  })
  .post(async (req, res) => {
    const {
      company_id, employee_id, category_id, payment_mode_id, transaction_type_id,
      expense_date, vendor_name, amount, taxable_value, total_gst, reference_number, description
    } = req.body;

    if (!company_id || !employee_id || !category_id || !payment_mode_id || !amount || !expense_date) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    try {
      // FIX: Auto-fetch department_id based on employee selection
      const [emp] = await db.query("SELECT department_id FROM employees WHERE employee_id = ?", [employee_id]);
      const deptId = emp.length > 0 ? emp[0].department_id : null;

      // FIX: Include taxable_value and total_gst in the INSERT
      const sql = `INSERT INTO expenses 
        (company_id, employee_id, department_id, category_id, payment_mode_id, transaction_type_id, 
         expense_date, vendor_name, amount, taxable_value, total_gst, reference_number, description, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

      const [result] = await db.query(sql, [
        company_id, employee_id, deptId, category_id, payment_mode_id, 
        transaction_type_id || 2, expense_date, vendor_name, amount, 
        taxable_value || 0, total_gst || 0, reference_number, description
      ]);

      res.status(201).json({ success: true, message: "Expense recorded.", expense_id: result.insertId });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })
  .put(async (req, res) => {
  const { 
    expense_id, 
    category_name, mode_name, recorded_by_name, department_name, transaction_type_name, // Destructure these to exclude them
    ...updateFields 
  } = req.body;

  if (!expense_id) {
    return res.status(400).json({ success: false, message: "expense_id is required" });
  }

  try {
    const fields = Object.keys(updateFields);
    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: "No fields provided for update" });
    }

    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const values = fields.map((field) => updateFields[field]);
    values.push(expense_id);

    const sql = `UPDATE expenses SET ${setClause} WHERE expense_id = ?`;
    const [result] = await db.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Expense record not found" });
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