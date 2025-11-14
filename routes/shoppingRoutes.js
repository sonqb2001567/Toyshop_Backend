import express, { Router } from "express";
import mysqlPool from "../db/mysqlPool.js";
import fs from "fs";
import path from "path";

const router = express.Router();

//GET all Toys
router.get("/get_all_toys", async (req, res) => {
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
                thumbnail_url: `https://fulminous-noncontemporaneously-laci.ngrok-free.dev/images${toy.image_file_path}/${toy.thumbnail}`
            }))
        });
    });
});

//GET Toys category
router.get("/get_categories", async (req, res) => {
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
router.get("/get_toys_from/:category", async (req, res) => {
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
                thumbnail_url: `https://fulminous-noncontemporaneously-laci.ngrok-free.dev/images${toy.image_file_path}/Thumbnail.jpg`
            }))
        });
    });
});

//GET Searched toys
router.get("/search_toys", (req, res) => {
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
                thumbnail_url: `https://fulminous-noncontemporaneously-laci.ngrok-free.dev/images${toy.image_file_path}/${toy.thumbnail}`
            }))
        });
    });
});

//GET all images file names
router.get("/get_images", (req, res) => {
    let folder = req.query.folder; // e.g. "Rubik_cube" or "images/Rubik_cube"
    if (!folder) {
        return res.status(400).json({ message: "Missing folder parameter" });
    }

    //normalize
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
router.get("/fetch_comments", (req, res) => {
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
router.post("/add_comment", async (req, res) => {
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

export default router;