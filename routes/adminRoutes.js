import express from "express";
import mysqlPoolPromise from "../db/mysqlPoolPromise.js";
import mysqlPool from "../db/mysqlPool.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { bucket } from "./firebaseAdmin.js";

const router = express.Router();

// Dashboard endpoint
router.get("/dashboard", async (req, res) => {
    try {
        //Total revenue
        const [totalRows] = await mysqlPoolPromise.execute(`
            SELECT SUM(total_amount) AS total_revenue
            FROM orders
            WHERE order_status = 'Delivered'
        `);

        //Order counts
        const [countRows] = await mysqlPoolPromise.execute(`
            SELECT
            SUM(order_status = 'Delivered') AS complete,
            SUM(order_status = 'Pending Payment') AS pending,
            SUM(order_status = 'Cancelled') AS cancelled
            FROM orders
        `);

        //Daily revenue trends (past 7 days)
        const [trendRows] = await mysqlPoolPromise.execute(`
            SELECT DATE(order_date) AS date, SUM(total_amount) AS revenue
            FROM orders
            WHERE order_status = 'Delivered'
            AND order_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(order_date)
            ORDER BY DATE(order_date)
        `);
        
        //Build an array for the last 7 days (including today)
        const today = new Date();
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(today.getDate() - (6 - i));
            return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
        });

        //Merge DB results with missing days = 0
        const filledTrends = last7Days.map(date => {
            const found = trendRows.find(row => row.date.toISOString
                ? row.date.toISOString().slice(0, 10) === date
                : row.date === date
            );
            return {
                date,
                revenue: found ? found.revenue : 0
            };
        });

        res.json({
            total_revenue: totalRows[0].total_revenue || 0,
            orders: {
                shipped: countRows[0].complete || 0,
                pending: countRows[0].pending || 0,
                cancelled: countRows[0].cancelled || 0
            },
            trends: filledTrends
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load dashboard data" });
    }
});

//GET all toys with stock info
router.get("/toys", async (req, res) => {
    try {
        const [rows] = await mysqlPoolPromise.execute(`
            SELECT toy_id, name, price, in_stock
            FROM toys
            ORDER BY toy_id DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error("Fetch toys error:", error);
        res.status(500).json({ error: "Failed to load toys" });
    }
});

//UPDATE stock for a specific toy
router.put("/toys/:id/stock", async (req, res) => {
    const { id } = req.params;
    const { in_stock } = req.body;

    if (typeof in_stock !== "number" || in_stock < 0) {
        return res.status(400).json({ error: "Invalid stock value" });
    }

    try {
        const [result] = await mysqlPoolPromise.execute(
            "UPDATE toys SET in_stock = ? WHERE toy_id = ?",
            [in_stock, id]
        );

        if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Toy not found" });
        }

        res.json({ message: "Stock updated successfully" });
    } catch (error) {
        console.error("Update stock error:", error);
        res.status(500).json({ error: "Failed to update stock" });
    }
});

//Adjust stock incrementally (PATCH)
router.patch("/toys/:id/stock", async (req, res) => {
    const { id } = req.params;
    const { change } = req.body; // e.g., { "change": -1 } or { "change": +10 }

    if (typeof change !== "number") {
        return res.status(400).json({ error: "Invalid change value" });
    }

    try {
        const [result] = await mysqlPoolPromise.execute(
            "UPDATE toys SET in_stock = in_stock + ? WHERE toy_id = ?",
            [change, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Toy not found" });
        }

        res.json({ message: "Stock adjusted successfully" });
    } catch (error) {
        console.error("Adjust stock error:", error);
        res.status(500).json({ error: "Failed to adjust stock" });
    }
});

const BASE_IMAGE_DIR = "E:/DACN/Document/images";
const MODEL_DIR = "E:/DACN/Document/Models";

//Multer setting
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let toyName = req.body.name?.trim();
        if (!toyName) return cb(new Error("Missing toy name"), "");

        // Tạo thư mục riêng cho đồ chơi
        const toyFolder = path.join(BASE_IMAGE_DIR, toyName);
        if (!fs.existsSync(toyFolder)) fs.mkdirSync(toyFolder, { recursive: true });
        
        if (file.fieldname === "model_file") {
            cb(null, MODEL_DIR);
        } else {
            cb(null, toyFolder);
        }
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

//Upload to models bucket helper function
async function uploadToFirebase(file, folder) {
    const firebasePath = `${folder}/${file.originalname}`;
    const uploadResponse = await bucket.upload(file.path, {
        destination: firebasePath,
        metadata: { contentType: file.mimetype },
    });
    await uploadResponse[0].makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${firebasePath}`;
};

//DELETE from models bucket
const deleteFromFirebase = async (url) => {
    if (!url) return;
    try {
        const cleanPath = url.replace(`/models`, "models");
        await bucket.file(cleanPath).delete();
        console.log("Deleted from Firebase:", cleanPath);
    } catch (err) {
        console.warn("Firebase delete failed:", err.message);
    }
};

//ADD New toy API
router.post("/toys/add", upload.fields([
        { name: "model_file", maxCount: 1 },
        { name: "images", maxCount: 10 },
        { name: "thumbnail", maxCount: 1 },
    ]),
    async (req, res) => {
        console.log("Fields:", req.body);
        console.log("Files:", req.files);
        try {
            const { name, description, price, category, in_stock } = req.body;
            const modelFile = req.files["model_file"]?.[0];
            const created_at = new Date();
            const updated_at = new Date();
            
            const toyFolder = path.join(BASE_IMAGE_DIR, name);
            // create path
            const modelPath = `/models/${req.files["model_file"]?.[0]?.originalname}`;
            const thumbnail = req.files["thumbnail"]?.[0]?.originalname || null;
            const imagePath = `/images/${name}`;
            
            // upload file to Firebase and get public URL
            let modelUrl = null;
            if (modelFile) modelUrl = await uploadToFirebase(modelFile, `models`);
            fs.rmSync(modelFile?.path ?? "", { force: true });

            console.log({
                name,
                description,
                price,
                category,
                modelPath,
                imagePath,
                thumbnail,
                in_stock,
                created_at,
                updated_at
            });

            const [result] = await mysqlPoolPromise.execute(
                `INSERT INTO toys (name, description, price, category, model_file_path, image_file_path, thumbnail, in_stock, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    name,
                    description,
                    price,
                    category,
                    modelPath,
                    imagePath,
                    thumbnail,
                    in_stock,
                    created_at,
                    updated_at,
                ]
            );

            res.status(200).json({
                message: "Toy added successfully!",
                toy_id: result.insertId,
                data: {
                    name,
                    description,
                    price,
                    category,
                    model_file_path: modelPath,
                    image_file_path: imagePath,
                    thumbnail,
                    in_stock,
                    created_at,
                    updated_at,
                },
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Error adding toy", error: err.message });
        }
    }
);

//DELETE toy
router.delete("/delete_toy/:id", async (req, res) => {
    const toyId = req.params.id;

    try {
        //Lấy thông tin toy trước khi xóa
        const [rows] = await mysqlPoolPromise.execute(
            "SELECT name, model_file_path, image_file_path, thumbnail FROM toys WHERE toy_id = ?",
            [toyId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Toy not found" });
        }

        const toy = rows[0];
        const toyFolder = path.join(BASE_IMAGE_DIR, toy.name);

        await mysqlPoolPromise.execute("DELETE FROM toys WHERE toy_id = ?", [toyId]);

        if (fs.existsSync(toyFolder)) {
            fs.rmSync(toyFolder, { recursive: true, force: true });
            console.log(`Deleted local folder: ${toyFolder}`);
        } else {
        console.warn(`Folder not found: ${toyFolder}`);
        }

        await deleteFromFirebase(toy.model_file_path);

        res.status(200).json({
            message: "Toy deleted successfully",
            toy_id: toyId,
        });
    } catch (err) {
        console.error("Error deleting toy:", err);
        res.status(500).json({ message: "Error deleting toy", error: err.message });
    }
});

//====UPDATE API====

//Update toy's data
router.put("/update/toysdata/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, description, category, thumbnail, in_stock } = req.body;

        const [result] = await mysqlPoolPromise.query(
            `UPDATE toys SET name=?, price=?, description=?, category=?, thumbnail=?, in_stock=? WHERE toy_id=?`,
            [name, price, description, category, thumbnail, in_stock, id]
        );

        if (result.affectedRows === 0)
            return res.status(404).json({ message: "Toy not found" });

        res.json({ message: "Toy updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

//UPDATE model
router.put("/update/model", upload.single("model_file"), async (req, res) => {
    try {
        const { old_model, id, name } = req.body;
        const file = req.file;
        const modelPath = `/models/${file.originalname}`;

        // Delete old model from Firebase
        if (old_model) await deleteFromFirebase(old_model);

        // Upload new model
        const newModelUrl = await uploadToFirebase(file, "models");
        fs.rmSync(file.path, { force: true });

        // Update DB
        await mysqlPoolPromise.query(`UPDATE toys SET model_file_path=? WHERE toy_id=?`, [modelPath, id]);

        res.json({ message: "Model updated", model_file_path: modelPath });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

//DELETE Local file helper
async function deleteFromFolder(filePath) {
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
        console.log(`Deleted local file: ${filePath}`);
    } else {
        console.warn(`File not found: ${filePath}`);
    }
};

//DELETE image (use post cause delete cant sent body in flutter)
router.delete("/delete_images", async (req, res) => {
    try {
        const { imagesPaths } = req.body; // full local file path

        if (imagesPaths.length === 0) {
            return res.status(200).json({ message: "No images deleted" });
        }
        
        const localPath = imagesPaths.map(imgPath => {
            return imgPath.replace("http://fulminous-noncontemporaneously-laci.ngrok-free.dev/images/images", BASE_IMAGE_DIR);
        });
        
        // Delete file from local
        for (const filePath of localPath) {
            await deleteFromFolder(filePath);
        }

        res.json({ message: "Image deleted successfully", images: localPath });
    } catch (err) {
        console.error("Error deleting image:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

//POST new images 
router.post("/add_images", upload.array("images"), async (req, res) => {
    try {
        const { image_file_path, name } = req.body;
        const newFiles = req.files;


        if (!newFiles || newFiles.length === 0 || !image_file_path) {
            return res.status(400).json({ message: "No images uploaded or no folder found" });
        }

        res.json({
            message: "Images uploaded successfully",
            images: newFiles.map(file => file.originalname)
        });
    } catch (err) {
        console.error("Error uploading images:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

//UPDATE thumbnail
router.put("/update_thumbnail", async (req, res) => {
    try {
        const { image_file_path, new_thumbnail_name, id } = req.body;

        if (!new_thumbnail_name || !image_file_path || !id) {
            return res.status(400).json({ message: "Missing thumbnail path or folder path or id" });
        }

        await mysqlPoolPromise.query(`UPDATE toys SET thumbnail = ? WHERE toy_id = ?`, [new_thumbnail_name, id]);

        res.json({ message: "Thumbnail updated successfully", thumbnail: new_thumbnail_name });
    } catch (err) {
        console.error("Error changing thumbnail:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

export default router;
