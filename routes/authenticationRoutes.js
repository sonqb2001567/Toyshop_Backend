import express, { Router } from "express";
import mysqlPool from "../db/mysqlPool.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const secret = "ARToyShopApp";

const router = express.Router();

//ADD new user
router.post("/add_user", async (req, res) => {
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
router.get("/get_user", (req, res) => {
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
router.post("/login", (req, res) => {
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
                email: user.email,
                role: user.role
            }
        });
    });
});

export default router