import express, { Router } from "express";
import mysqlPool from "../db/mysqlPool.js";

const router = express.Router();

//ADD a new order
router.post("/create_new_order", (req, res) => {
    const {user_id, total_amount, order_status, shipping_address} = req.body;
    console.log("Result:" + req.body);

    const sql = "INSERT INTO orders (user_id, total_amount, order_status, shipping_address) VALUES (?, ?, ?, ?)";

    mysqlPool.query(sql, [user_id, total_amount, order_status, shipping_address], (err, res) => {
        if (err) {
            console.error("Insert error:", err);
            return res.status(500).send({
                status_code: 500,
                message: "Database insert failed"
            });
        }

        res.status(200).send({
            status_code: 200,
            message: "Order added successfully",
            order: {
                user_id: user_id,
                total_amount: total_amount,
                order_status: order_status,
                shipping_address: shipping_address
            }
        });
    });
})

//ADD items to order_items
router.post("/add_items_to_order", (req, res) => {
    const {order_id, toy_id, quantity, unit_price} = req.body;
    console.log("Result:" + req.body);

    const sql = "INSERT INTO order_items (order_id, toy_id, quantity, unit_price) VALUES (?, ?, ?, ?)";

    mysqlPool.query(sql, [order_id, toy_id, quantity, unit_price], (err, res) => {
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

export default router;