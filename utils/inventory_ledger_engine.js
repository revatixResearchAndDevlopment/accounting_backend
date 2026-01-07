const db = require("../config/db_config");

/**
 * Processes inventory and ledger movements.
 * @param {Object} conn - The database connection (for transactions)
 * @param {Number} invoiceId - The ID of the invoice
 * @param {Object} header - The invoice header data
 * @param {Array} items - The array of invoice items
 * @param {String} mode - 'POST' (deduct) or 'CANCEL' (restore)
 */
async function processInventoryAndLedger(conn, invoiceId, header, items, mode = 'POST') {
    const isPost = mode === 'POST';
    
    for (const item of items) {
        // 1. Check Negative Inventory Settings if Posting
        if (isPost) {
            const [stock] = await conn.query(
                "SELECT quantity, allow_negative_inventory FROM inventory_company_map WHERE product_id = ? AND company_id = ?",
                [item.product_id, header.company_id]
            );
            if (!stock[0]?.allow_negative_inventory && (stock[0]?.quantity || 0) < item.quantity) {
                throw new Error(`Insufficient stock for Product ID ${item.product_id}`);
            }
        }

        // 2. Update Stock Map
        const qtyModifier = isPost ? -item.quantity : item.quantity;
        await conn.query(
            "UPDATE inventory_company_map SET quantity = quantity + ? WHERE product_id = ? AND company_id = ?",
            [qtyModifier, item.product_id, header.company_id]
        );

        // 3. Record in Inventory Log
        // Source Type 1: Sales, Source Type 4: Cancellation
        const typeId = isPost ? 1 : 4; 
        await conn.query(
            "INSERT INTO inventory_log (product_id, company_id, source_type_id, source_id, quantity_change) VALUES (?, ?, ?, ?, ?)",
            [item.product_id, header.company_id, typeId, invoiceId, qtyModifier]
        );
    }

    // 4. Update Customer Ledger
    // Transaction Type 1: Sales, Transaction Type 3: Sales Return/Cancel
    await conn.query("INSERT INTO customer_ledger SET ?", {
        customer_id: header.customer_id,
        company_id: header.company_id,
        transaction_type_id: isPost ? 1 : 3,
        transaction_id: invoiceId,
        transaction_date: new Date(),
        debit: isPost ? header.total_amount : 0,
        credit: isPost ? 0 : header.total_amount,
        description: `${isPost ? 'Posted' : 'Cancelled'} Invoice No: ${header.invoice_number}`
    });
}

module.exports = { processInventoryAndLedger };