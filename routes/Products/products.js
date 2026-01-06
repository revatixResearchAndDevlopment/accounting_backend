const express = require("express");
const app = express();
app.use(express.json());
const db = require("../../config/db_config");

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

      const dataSql = `
            SELECT 
                p.product_id, p.name, p.hsn_sac, p.item_type, p.default_gst_rate,
                u.unit_code, u.unit_name,
                m.custom_sku, m.sales_price, m.purchase_price, m.current_stock,
                inv.inventory_name
            FROM inventory_company_map m
            INNER JOIN products p ON m.product_id = p.product_id
            LEFT JOIN uqc_units u ON p.uqc_id = u.uqc_id
            LEFT JOIN inventory inv ON m.inventory_id = inv.inventory_id
            WHERE m.company_id = ?
            ORDER BY p.product_id DESC
            LIMIT ? OFFSET ?`;

      const [rows] = await db.query(dataSql, [parseInt(company_id), limit + 1, offset]);

      const hasMore = rows.length > limit;
      const dataToSend = hasMore ? rows.slice(0, limit) : rows;

      res.json({
        success: true,
        data: dataToSend,
        metadata: { currentPage: page, hasMore, recordsInChunk: dataToSend.length },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  })
  .post(async (req, res) => {
    const {
      name, hsn_sac, item_type, uqc_id, gst_rate,
      company_id, sales_price, purchase_price, custom_sku, 
      initial_stock, inventory_id
    } = req.body;

    if (!name || !hsn_sac || !company_id) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Insert into products (Global Definition)
      const [productResult] = await connection.query(
        `INSERT INTO products (name, hsn_sac, item_type, uqc_id, default_gst_rate) VALUES (?, ?, ?, ?, ?)`,
        [name, hsn_sac, item_type || "goods", uqc_id, gst_rate || 18.0]
      );
      const productId = productResult.insertId;

      // 2. Map to existing Inventory and Store Stock/Price (Bridge Table)
      // Note: We use inventory_id from body or default to 1
      await connection.query(
        `INSERT INTO inventory_company_map (company_id, product_id, inventory_id, custom_sku, sales_price, purchase_price, current_stock) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [company_id, productId, inventory_id || 1, custom_sku, sales_price, purchase_price, initial_stock || 0]
      );

      await connection.commit();
      res.status(201).json({ success: true, message: "Product created and stock added.", product_id: productId });
    } catch (error) {
      await connection.rollback();
      res.status(500).json({ success: false, message: "Transaction failed", error: error.message });
    } finally {
      connection.release();
    }
  })
  .put(async (req, res) => {
    const { product_id, company_id, ...updateFields } = req.body;

    if (!product_id || !company_id) {
      return res.status(400).json({ success: false, message: "product_id and company_id are required" });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const productTableFields = ["name", "hsn_sac", "item_type", "uqc_id", "default_gst_rate"];
      const mapTableFields = ["custom_sku", "sales_price", "purchase_price", "current_stock"];

      // Update Products Table
      const productUpdates = Object.keys(updateFields).filter((f) => productTableFields.includes(f));
      if (productUpdates.length > 0) {
        const setClause = productUpdates.map((f) => `${f} = ?`).join(", ");
        const values = productUpdates.map((f) => updateFields[f]);
        values.push(product_id);
        await connection.query(`UPDATE products SET ${setClause} WHERE product_id = ?`, values);
      }

      // Update Mapping Table (Stock and Pricing)
      const mapUpdates = Object.keys(updateFields).filter((f) => mapTableFields.includes(f));
      if (mapUpdates.length > 0) {
        const setClause = mapUpdates.map((f) => `${f} = ?`).join(", ");
        const values = mapUpdates.map((f) => updateFields[f]);
        values.push(product_id, company_id);
        await connection.query(`UPDATE inventory_company_map SET ${setClause} WHERE product_id = ? AND company_id = ?`, values);
      }

      await connection.commit();
      res.json({ success: true, message: "Product and stock details updated." });
    } catch (error) {
      await connection.rollback();
      res.status(500).json({ success: false, message: error.message });
    } finally {
      connection.release();
    }
  })
  .delete(async (req, res) => {
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).json({ success: false, message: "product_id is required." });
    }

    try {
      // Deleting from products will CASCADE and delete the row in inventory_company_map
      // BUT it will NOT delete the row in 'inventory' (Warehouse) table.
      const [result] = await db.query("DELETE FROM products WHERE product_id = ?", [product_id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Product not found." });
      }

      res.json({ success: true, message: "Product and stock mapping deleted successfully." });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

module.exports = app;