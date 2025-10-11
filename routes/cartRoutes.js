import express, { Router } from "express";
import mysqlPool from "../db/mysqlPool.js";

const router = express.Router();

//ADD toy to Cart
router.post("/add_to_cart", (req, res) => {
    const { user_id, toy_id, quantity } = req.body;

    if (!user_id || !toy_id) {
        return res.status(400).json({ message: "user_id and toy_id are required" });
    }

    const qty = quantity || 1;

    // Step 1: Check if cart exists
    const checkCartSql = `SELECT cart_id FROM shopping_cart WHERE user_id = ? LIMIT 1`;

    mysqlPool.query(checkCartSql, [user_id], (err, results) => {
        if (err) {
            console.error("Error checking cart:", err);
            return res.status(500).json({ message: "Database error" });
        }

        let cartId;

        if (results.length > 0) {
            // Cart exists
            cartId = results[0].cart_id;
            insertOrUpdateCartItem(cartId);
        } else {
            // Step 2: Create new cart
            const createCartSql = `INSERT INTO shopping_cart (user_id, created_at) VALUES (?, NOW())`;

            mysqlPool.query(createCartSql, [user_id], (err, result) => {
                if (err) {
                    console.error("Error creating cart:", err);
                    return res.status(500).json({ message: "Database error" });
                }

                cartId = result.insertId;
                insertOrUpdateCartItem(cartId);
            });
        }

        // Step 3: Insert or update cart_items
        function insertOrUpdateCartItem(cartId) {
            const sql = `
                INSERT INTO cart_items (cart_id, toy_id, quantity)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE quantity = quantity + ?;
            `;

            mysqlPool.query(sql, [cartId, toy_id, qty, qty], (err, result) => {
                if (err) {
                    console.error("Error adding to cart:", err);
                    return res.status(500).json({ message: "Database error" });
                }

                return res.json({
                    message: "Item added to cart successfully",
                    cart_item: { cart_id: cartId, toy_id, quantity: qty }
                });
            });
        }
    });
});

//ADD new Cart
router.post("/add_new_cart", (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ message: "user_id is required" });
    }

    const sql = `
        INSERT INTO shopping_cart (user_id) VALUES (?);
    `;

    mysqlPool.query(sql, [user_id], (err, result) => {
        if (err) {
            console.error("Error adding cart:", err);
            return res.status(500).json({ message: "Database error" });
        }

        return res.json({ 
            message: "Cart added successfully",
        });
    });
});

//DELETE item from cart
router.delete("/remove_from_cart", (req, res) => {
    const { cart_id, cart_item_id } = req.body;

    if (!cart_id || !cart_item_id) {
        return res.status(400).json({ message: "cart_id and cart_item_id are required" });
    }

    const sql = "DELETE FROM cart_items WHERE cart_id = ? AND cart_item_id = ?";

    mysqlPool.query(sql, [cart_id, cart_item_id], (err, result) => {
        if (err) {
        console.error("Error removing from cart:", err);
        return res.status(500).json({ message: "Database error" });
        }

        if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Item not found in cart" });
        }

        return res.json({ message: "Item removed from cart successfully" });
    });
});

//GET cart item of user
router.get("/get_cart/:user_id", (req, res) => {
    const user_id = req.params.user_id;

    if (!user_id) {
        return res.status(400).json({ message: "user_id is required" });
    }

    const sql = `
       SELECT 
        c.cart_id,
        ci.cart_item_id,
        ci.toy_id,
        ci.quantity,
        t.name AS toy_name,
        t.price,
        t.image_file_path,
        t.thumbnail
        FROM shopping_cart c
        JOIN cart_items ci ON c.cart_id = ci.cart_id
        JOIN toys t ON ci.toy_id = t.toy_id
        WHERE c.user_id = ?;
    `;

    mysqlPool.query(sql, [user_id], (err, results) => {
        if (err) {
            console.error("Error fetching cart:", err);
            return res.status(500).json({ message: "Database error" });
        }

        if (results.length === 0) {
            return res.json({
                status_code: 200,
                message: "Cart is empty",
                cart: []
            });
        }

        return res.json({
            status_code: 200,
            message: "Cart fetched successfully",
            cart: results.map(toy => ({
                ...toy,
                thumbnail_url: `http://192.168.100.113:2000/images${toy.image_file_path}/${toy.thumbnail}`
            }))
        });
    });
});

export default router;