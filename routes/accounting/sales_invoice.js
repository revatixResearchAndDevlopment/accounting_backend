const express = require("express");
const app = express();
const db = require("../../config/db_config");
const { processInventoryAndLedger } = require("../../utils/inventory_ledger_engine");

app.use(express.json());

app.route("/")
  // GET: List invoices
  .get(async (req, res) => {
    try {
      const { company_id } = req.query;
      const [rows] = await db.query(`
        SELECT si.*, c.customer_name 
        FROM sales_invoices si
        JOIN customers c ON si.customer_id = c.customer_id
        WHERE si.company_id = ? ORDER BY si.invoice_date DESC`, [company_id]);
      res.json({ success: true, data: rows });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })

  // POST: Create new (Defaults to Draft)
  .post(async (req, res) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const { items, ...header } = req.body;
      header.status = header.status || 'Draft';

      const [inv] = await conn.query("INSERT INTO sales_invoices SET ?", [header]);
      const invoiceId = inv.insertId;

      const itemValues = items.map(item => [
        invoiceId, item.product_id, item.hsn_sac, item.quantity, 
        item.unit_price, item.taxable_value, item.gst_rate, 
        item.cgst_amount, item.sgst_amount, item.igst_amount, item.total_item_amount
      ]);
      await conn.query("INSERT INTO sales_invoice_items (invoice_id, product_id, hsn_sac, quantity, unit_price, taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, total_item_amount) VALUES ?", [itemValues]);

      if (header.status === 'Active') {
        await processInventoryAndLedger(conn, invoiceId, header, items, 'POST');
      }

      await conn.commit();
      res.status(201).json({ success: true, invoice_id: invoiceId });
    } catch (error) {
      await conn.rollback();
      res.status(400).json({ success: false, message: error.message });
    } finally {
      conn.release();
    }
  })

  // PUT: Update Draft
  .put(async (req, res) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const { invoice_id, items, ...header } = req.body;

      const [existing] = await conn.query("SELECT status FROM sales_invoices WHERE invoice_id = ?", [invoice_id]);
      if (existing[0]?.status !== 'Draft') throw new Error("Only Drafts can be edited.");

      await conn.query("UPDATE sales_invoices SET ? WHERE invoice_id = ?", [header, invoice_id]);
      await conn.query("DELETE FROM sales_invoice_items WHERE invoice_id = ?", [invoice_id]);
      
      const itemValues = items.map(item => [
        invoice_id, item.product_id, item.hsn_sac, item.quantity, 
        item.unit_price, item.taxable_value, item.gst_rate, 
        item.cgst_amount, item.sgst_amount, item.igst_amount, item.total_item_amount
      ]);
      await conn.query("INSERT INTO sales_invoice_items (...) VALUES ?", [itemValues]);

      await conn.commit();
      res.json({ success: true, message: "Draft updated" });
    } catch (error) {
      await conn.rollback();
      res.status(400).json({ success: false, message: error.message });
    } finally {
      conn.release();
    }
  })

  // DELETE: Delete Draft
  .delete(async (req, res) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const { invoice_id } = req.body;
      const [existing] = await conn.query("SELECT status FROM sales_invoices WHERE invoice_id = ?", [invoice_id]);

      if (existing[0]?.status !== 'Draft') throw new Error("Only drafts can be deleted.");

      await conn.query("DELETE FROM sales_invoice_items WHERE invoice_id = ?", [invoice_id]);
      await conn.query("DELETE FROM sales_invoices WHERE invoice_id = ?", [invoice_id]);

      await conn.commit();
      res.json({ success: true, message: "Draft deleted" });
    } catch (error) {
      await conn.rollback();
      res.status(400).json({ success: false, message: error.message });
    } finally {
      conn.release();
    }
  });

// PATCH: Post (Draft -> Active)
app.patch("/post", async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { invoice_id } = req.body;

        const [inv] = await conn.query("SELECT * FROM sales_invoices WHERE invoice_id = ?", [invoice_id]);
        const [items] = await conn.query("SELECT * FROM sales_invoice_items WHERE invoice_id = ?", [invoice_id]);

        if (inv[0].status !== 'Draft') throw new Error("Invoice is not in Draft status.");

        await conn.query("UPDATE sales_invoices SET status = 'Active' WHERE invoice_id = ?", [invoice_id]);
        await processInventoryAndLedger(conn, invoice_id, inv[0], items, 'POST');

        await conn.commit();
        res.json({ success: true, message: "Invoice posted!" });
    } catch (error) {
        await conn.rollback();
        res.status(400).json({ success: false, message: error.message });
    } finally {
        conn.release();
    }
});

// PATCH: Cancel (Active -> Cancelled)
app.patch("/cancel", async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const { invoice_id, company_id } = req.body;

        const [inv] = await conn.query("SELECT * FROM sales_invoices WHERE invoice_id = ?", [invoice_id]);
        const [items] = await conn.query("SELECT * FROM sales_invoice_items WHERE invoice_id = ?", [invoice_id]);

        if (inv[0].status !== 'Active') throw new Error("Only Active invoices can be cancelled.");

        await conn.query("UPDATE sales_invoices SET status = 'Cancelled' WHERE invoice_id = ?", [invoice_id]);
        await processInventoryAndLedger(conn, invoice_id, inv[0], items, 'CANCEL');

        await conn.commit();
        res.json({ success: true, message: "Invoice cancelled and stock restored." });
    } catch (error) {
        await conn.rollback();
        res.status(400).json({ success: false, message: error.message });
    } finally {
        conn.release();
    }
});

module.exports = app;