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

      // JOIN query to pull data from mapping, global products, and units
      const dataSql = `
            SELECT 
                p.product_id, p.name, p.hsn_sac, p.item_type, p.default_gst_rate,
                u.unit_code, u.unit_name,
                m.custom_sku, m.sales_price, m.purchase_price,
                i.current_stock
            FROM inventory_company_map m
            INNER JOIN products p ON m.product_id = p.product_id
            LEFT JOIN uqc_units u ON p.uqc_id = u.uqc_id
            LEFT JOIN inventory i ON m.inventory_id = i.inventory_id
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
      company_id, sales_price, purchase_price, custom_sku, initial_stock
    } = req.body;

    if (!name || !hsn_sac || !company_id) {
      return res.status(400).json({ success: false, message: "Product name, HSN, and company_id are required." });
    }

    // Start a Transaction to ensure data integrity across 3 tables
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Insert into products (Global Table)
      const [productResult] = await connection.query(
        `INSERT INTO products (name, hsn_sac, item_type, uqc_id, default_gst_rate) VALUES (?, ?, ?, ?, ?)`,
        [name, hsn_sac, item_type || 'goods', uqc_id, gst_rate || 18.0]
      );
      const productId = productResult.insertId;

      // 2. Insert into inventory (Stock Table)
      const [inventoryResult] = await connection.query(
        `INSERT INTO inventory (product_id, current_stock) VALUES (?, ?)`,
        [productId, initial_stock || 0]
      );
      const inventoryId = inventoryResult.insertId;

      // 3. Insert into inventory_company_map (Tenant Bridge Table)
      await connection.query(
        `INSERT INTO inventory_company_map (company_id, product_id, inventory_id, custom_sku, sales_price, purchase_price) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [company_id, productId, inventoryId, custom_sku, sales_price, purchase_price]
      );

      await connection.commit();
      res.status(201).json({ success: true, message: "Product created and mapped to company.", product_id: productId });
    } catch (error) {
      await connection.rollback();
      res.status(500).json({ success: false, message: "Transaction failed", error: error.message });
    } finally {
      connection.release();
    }
  });

module.exports = app;