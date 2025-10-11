const bcrypt = require("bcryptjs");
const express = require("express");
const fs = require("fs");
const conn = require("mysql2");
const path = require("path");
const jwt = require("jsonwebtoken");
const secret = "ARToyShopApp";

const mysqlPool = conn.createPool({
    host: "localhost",
    user: "root",
    password: "bimqb2001",
    database: "datn",
    connectionLimit: 10
})

const app = express();

app.use("/images", express.static("E:/DACN/Document"));

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.listen(2000, () => {
    console.log("Connected to server at 2000");
});

//ADD new user
app.post("/api/add_user", async (req, res) => {
    const { username, email, password, fullname, phonenumber, address } = req.body;
    console.log("Result: ", req.body);

    const sql = "INSERT INTO users (username, email, password_hash, full_name, phone_number, address) VALUES (?, ?, ?, ?, ?, ?)";
    const hashedPassword = await bcrypt.hash(password, 10);

    mysqlPool.query(sql, [username, email, hashedPassword, fullname, phonenumber, address], (err, result) => {
        if (err) {
            console.error("Insert error:", err);
            return res.status(500).send({
                status_code: 500,
                message: "Database insert failed"
            });
        }

        const udata = {
            id: result.insertId,
            username,
            email,
            hashedPassword
        };

        console.log("Final", udata);

        res.status(200).send({
            status_code: 200,
            message: "User added successfully",
            user: udata
        });
    });
});

//GET all users
app.get("/api/get_user", (req, res) => {
    const sql = "SELECT user_id, username, email, password_hash FROM users";

    mysqlPool.query(sql, (err, results) => {
        if (err) {
        console.error("Error fetching users:", err);
        return res.status(500).send({
            status_code: 500,
            message: "Database error",
            user: []
        });
        }

        res.status(200).send({
            status_code: 200,
            message: "User get successfully",
            user: results
        });
    });
});

//LOGIN API
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send({
            status_code: 400,
            message: "Username and password required"
        });
    }

    const sql = "SELECT * FROM users WHERE username = ? OR email = ? OR phone_number = ?";
    mysqlPool.query(sql, [username, username, username], async (err, results) => {
        if (err) {
            console.error("Login query error:", err);
            return res.status(500).send({
                status_code: 500,
                message: "Database error"
            });
        }

        if (results.length === 0) {
            return res.status(401).send({
                status_code: 401,
                message: "Invalid username or password"
            });
        }

        const user = results[0];
        
        // check password hash
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).send({
                status_code: 401,
                message: "Invalid username or password"
            });
        }

        const token = jwt.sign({ id: user.user_id, username: user.username }, secret, { expiresIn: "7d" });

        res.status(200).send({
            status_code: 200,
            message: "Login successful",
            token,
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email
            }
        });
    });
});

//GET all Toys
app.get("/api/get_all_toys", async (req, res) => {
    const sql = "SELECT * FROM toys_with_rating";

    mysqlPool.query(sql, (err, results) => {
        if (err) {
        console.error("Error fetching toys:", err);
        return res.status(500).send({
            status_code: 500,
            message: "Database error",
            toys: []
        });
        }

        res.status(200).send({
            status_code: 200,
            message: "Toys get successfully",
           toys: results.map(toy => ({
                ...toy,
                thumbnail_url: `http://192.168.100.113:2000/images${toy.image_file_path}/${toy.thumbnail}`
            }))
        });
    });
});

//GET Toys category
app.get("/api/get_categories", async (req, res) => {
    const sql = "SELECT * FROM toy_categories";

    mysqlPool.query(sql, (err, results) => {
        if (err) {
        console.error("Error fetching toys:", err);
        return res.status(500).send({
            status_code: 500,
            message: "Database error",
            categories: []
        });
        }

        res.status(200).send({
            status_code: 200,
            message: "Toys get successfully",
            categories: results
        });
    });
});

//GET all toys from a category
app.get("/api/get_toys_from/:category", async (req, res) => {
    const category = req.params.category;

    const sql = "SELECT * FROM toys_with_rating Where category = ?";

    mysqlPool.query(sql, [category], (err, results) => {
        if (err) {
        console.error("Error fetching toys:", err);
        return res.status(500).send({
            status_code: 500,
            message: "Database error",
            toys: []
        });
        }

        res.status(200).send({
            status_code: 200,
            message: "Toys get successfully",
           toys: results.map(toy => ({
                ...toy,
                thumbnail_url: `http://192.168.100.113:2000/images${toy.image_file_path}/Thumbnail.jpg`
            }))
        });
    });
});

//GET Searched toys
app.get("/api/search_toys", (req, res) => {
    const query = req.query.query;

    if (!query) {
        return res.status(400).json({ message: "Missing search query" });
    }

    
    const sql = `
        SELECT * FROM toys_with_rating WHERE name LIKE ? OR category LIKE ? OR description LIKE ?
    `;

    const searchTerm = `%${query}%`;

    mysqlPool.query(sql, [searchTerm, searchTerm, searchTerm], (err, results) => {
        if (err) {
        console.error("Error fetching toys:", err);
        return res.status(500).send({
            status_code: 500,
            message: "Database error",
            toys: []
        });
        }

        res.status(200).send({
            status_code: 200,
            message: "Toys searched successfully",
            toys: results.map(toy => ({
                ...toy,
                thumbnail_url: `http://192.168.100.113:2000/images${toy.image_file_path}/Thumbnail.jpg`
            }))
        });
    });
});

//GET all images file names
app.get("/api/get_images", (req, res) => {
    let folder = req.query.folder; // e.g. "Rubik_cube" or "images/Rubik_cube"
    if (!folder) {
        return res.status(400).json({ message: "Missing folder parameter" });
    }

    // Remove quotes and normalize
    folder = folder.replace(/^["']|["']$/g, "");

    // Ensure no path traversal like "../../"
    const safeFolder = path.normalize(folder).replace(/^(\.\.(\/|\\|$))+/, "");

    // Full system path
    const folderPath = path.join("E:/DACN/Document", safeFolder);

    if (!fs.existsSync(folderPath)) {
        return res.status(404).json({ message: "Folder not found " + folderPath});
    }

    fs.readdir(folderPath, (err, files) => {
        if (err) {
            return res.status(500).json({ message: "Error reading folder" });
        }

        const imageFiles = files.filter(file =>/\.(jpg|jpeg|png|gif|webp)$/i.test(file));

        const imageUrls = imageFiles.map(file => 
            `${req.protocol}://${req.get("host")}/images${folder}/${file}`
        );

        res.json({
            status_code: 200,
            message: "Images fetched successfully",
            images: imageUrls,
        });
    });
});

//GET Comments
app.get("/api/fetch_comments", (req, res) => {
    const toy_id = req.query.toy_id;

    if (!toy_id) {
        return res.status(400).json({ message: "Missing search toy" });
    }

    
    const sql = `SELECT * FROM user_comments WHERE toy_id = ? ORDER BY created_at DESC`;

    mysqlPool.query(sql, toy_id, (err, results) => {
        if (err) {
        console.error("Error fetching comments:", err);
        return res.status(500).send({
            status_code: 500,
            message: "Database error",
            comments: []
        });
        }

        res.status(200).send({
            status_code: 200,
            message: "Comments searched successfully",
            comments: results.map(comments => ({
                ...comments
            }))
        });
    });
});

//ADD new comment
app.post("/api/add_comment", async (req, res) => {
    const { user_id, toy_id, comment_text, rating } = req.body;
    console.log("Result: ", req.body);

    const sql = "INSERT INTO comments (user_id, toy_id, comment_text, rating) VALUES (?, ?, ?, ?)";
    
    mysqlPool.query(sql, [user_id, toy_id, comment_text, rating], (err, result) => {
        if (err) {
            console.error("Insert error:", err);
            return res.status(500).send({
                status_code: 500,
                message: "Database insert failed"
            });
        }

        res.status(200).send({
            status_code: 200,
            message: "Comment added successfully",
            comments: {
                user_id: user_id, 
                toy_id: toy_id, 
                comment_text: comment_text, 
                rating: rating
            }
        });
    });
});

//ADD toy to Cart
app.post("/api/add_to_cart", (req, res) => {
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
app.post("/api/add_new_cart", (req, res) => {
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
app.delete("/api/remove_from_cart", (req, res) => {
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
app.get("/api/get_cart/:user_id", (req, res) => {
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

//ADD a new order
app.post("api/create_new_order", (req, res) => {
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
app.post("api/add_items_to_order", (req, res) => {
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
app.delete("/api/remove_item_from_order", (req, res) => {
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
