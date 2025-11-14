import express, { Router } from "express";
import mysqlPool from "../db/mysqlPool.js";

const router = express.Router();

//ADD a new order
router.post("/create_new_order", (req, res) => {
    const {user_id, total_amount, name, phonenumber, order_status, shipping_address, additional_info, items} = req.body;
    console.log("Result:" + req.body);

    const sql = `INSERT INTO orders (
            user_id,
            total_amount, 
            customer_name, 
            phone_number, 
            order_status, 
            shipping_address, 
            additional_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    mysqlPool.query(sql, [user_id, total_amount, name, phonenumber, order_status, shipping_address, additional_info], (err, results) => {
        if (err) {
            console.error("Insert error:", err);
            return res.status(500).send({
                status_code: 500,
                message: "Database insert failed"
            });
        }

        const orderId = results.insertId; // Get the new order_id
        console.log("Order created with ID:", orderId);

        if (!items || items.length === 0) {
            return res.status(200).send({
                status_code: 200,
                message: "Order added successfully (no items provided)",
                order_id: orderId,
            });
        }

        // Insert all items into order_items
        const sqlItems = `
            INSERT INTO order_items (order_id, toy_id, quantity, unit_price)
            VALUES ?
        `;

        const itemValues = items.map(item => [orderId, item.toy_id, item.quantity, item.price]);

        mysqlPool.query(sqlItems, [itemValues], (itemErr, itemResults) => {
            if (itemErr) {
                console.error("Insert items error:", itemErr);
                return res.status(500).send({
                    status_code: 500,
                    message: "Database insert failed (order items)",
                });
            }

            res.status(200).send({
                status_code: 200,
                message: "Order and items added successfully",
                order_id: orderId,
                total_items_inserted: itemResults.affectedRows,
            });
        });
    });
});

//ADD items to order_items
router.post("/add_items_to_order", (req, res) => {
    const {order_id, toy_id, quantity, unit_price} = req.body;
    console.log("Result:" + req.body);

    const sql = "INSERT INTO order_items (order_id, toy_id, quantity, unit_price) VALUES (?, ?, ?, ?)";

    mysqlPool.query(sql, [order_id, toy_id, quantity, unit_price], (err, result) => {
        if (err) {
            console.error("Insert error:", err);
            return res.status(500).send({
                status_code: 500,
                message: "Database insert failed"
            });
        }

        res.status(200).send({
            status_code: 200,
            message: "Items added to Order successfully",
            order: {
                order_id: order_id,
                toy_id: toy_id,
                quantity: quantity,
                unit_price: unit_price
            }
        });
    });
})

// DELETE item from order_items
router.delete("/remove_item_from_order", (req, res) => {
    const { order_item_id } = req.body;

    // Validate input
    if (!order_item_id) {
        return res.status(400).send({
            status_code: 400,
            message: "order_item_id is required"
        });
    }

    const sql = "DELETE FROM order_items WHERE order_item_id = ?";

    mysqlPool.query(sql, [order_item_id], (err, result) => {
        if (err) {
            console.error("Error deleting from order_items:", err);
            return res.status(500).send({
                status_code: 500,
                message: "Database error deleting order item"
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).send({
                status_code: 404,
                message: "Order item not found"
            });
        }

        return res.status(200).send({
            status_code: 200,
            message: "Item removed from order successfully"
        });
    });
});

//Get all orders by user_id
router.get("/get_user_orders/:user_id", (req, res) => {
    const { user_id } = req.params;

    const sql = `
        SELECT 
        o.order_id,
        o.total_amount,
        o.order_status,
        o.order_date,
        o.shipping_address,
        o.additional_info,
        GROUP_CONCAT(
            JSON_OBJECT(
            'toy_name', t.name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'image_file_path', t.image_file_path,
            'thumbnail_url', t.thumbnail
            )
        ) AS items
        FROM orders o
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        LEFT JOIN toys t ON oi.toy_id = t.toy_id
        WHERE o.user_id = ?
        GROUP BY o.order_id
        ORDER BY o.order_date DESC;
    `;

    mysqlPool.query(sql, [user_id], (err, results) => {
        if (err) {
            console.error("Error fetching orders:", err);
            return res.status(500).send({ message: "Database error" });
        }

        
        const orders = results.map(row => ({
            order_id: row.order_id,
            total_amount: row.total_amount,
            order_status: row.order_status,
            order_date: row.order_date,
            shipping_address: row.shipping_address,
            additional_infor: row.additional_infor,
            items: row.items ? JSON.parse(`[${row.items}]`) : [],
            thumbnail_url: `https://fulminous-noncontemporaneously-laci.ngrok-free.dev/images${row.image_file_path}/Thumbnail.jpg`,
        }));

        res.status(200).send({ orders });
    });
});

export default router;