import express from "express";
import multer from "multer";
import fs from "fs";
import axios from "axios";
import { EventSourcePolyfill } from "event-source-polyfill";

const router = express.Router();
const upload = multer({ dest: "uploads/" });
const apiKey = process.env.MESHY_AI_API_KEY;

//Sent a request to meshy ai
router.post("/meshy/upload", upload.array("images", 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) { 
      return res.status(400).json({ error: "No images uploaded" });
    }

    // Read uploaded images and convert to base64
    const imageUrls = req.files.map(file => {
        const base64 = fs.readFileSync(file.path, { encoding: "base64" });
        const mimeType = file.mimetype; // image/png
        return `data:${mimeType};base64,${base64}`;
    });

    const headers = {
        Authorization: `Bearer ${apiKey}`,
    };

    const payload = {
        image_urls: imageUrls,
        should_remesh: true,
        should_texture: true,
        enable_pbr: true,
    };

    const response = await axios.post(
        "https://api.meshy.ai/openapi/v1/multi-image-to-3d",
        payload,
        { headers }
    );

    // Cleanup temp files
    req.files.forEach(f => fs.unlinkSync(f.path));

    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

//Track task status
router.get("/meshy/track/:taskId", async (req, res) => {
  const { taskId } = req.params;
  
  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const url = `https://api.meshy.ai/openapi/v1/multi-image-to-3d/${taskId}/stream`;
  const es = new EventSourcePolyfill(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  es.onmessage = (event) => {
    const data = JSON.parse(event.data);
    res.write(`data: ${JSON.stringify(data)}\n\n`);

    // When task finishes, stop streaming
    if (["SUCCEEDED", "FAILED", "CANCELED"].includes(data.status)) {
      es.close();
      res.end();
    }
  };

  es.onerror = (error) => {
    console.error(`Stream error: ${apiKey}`, error);
    res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
    es.close();
    res.end();
  };

  req.on("close", () => {
    es.close();
  });
});

//GET Meshy task result
router.get("/meshy/result/:taskId", async (req, res) => {
  const { taskId } = req.params;

  try {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
    };

    const response = await axios.get(
      `https://api.meshy.ai/openapi/v1/multi-image-to-3d/${taskId}`,
      { headers }
    );
    console.log(response.data);
    // Send the result data back to your frontend
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching task result:", error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data || "Failed to fetch task result",
    });
  }
});

// Convert size string like "15 cm" or "0.5 m" into meters
function convertToMeters(sizeString) {
  if (!sizeString) return null;

  const [valueStr, unit] = sizeString.trim().split(/\s+/);
  const value = parseFloat(valueStr);
  if (isNaN(value)) return null;

  switch (unit.toLowerCase()) {
    case "m":
      return value;
    case "cm":
      return value / 100;
    case "mm":
      return value / 1000;
    case "inches":
      return value * 0.0254;
    case "feet":
      return value * 0.3048;
    default:
      console.warn("Unknown unit:", unit);
      return value; // assume already in meters
  }
}

//Remesh the model
router.post("/meshy/remesh", async (req, res) => {
  const {id, size} = req.body;
  const headers = { Authorization: `Bearer ${apiKey}` };
  const sizeInMeters = convertToMeters(size);

  const payload = {
    input_task_id: id,
    target_formats: ["glb"],
    resize_height: sizeInMeters,
  };

  try {
    const response = await axios.post(
      'https://api.meshy.ai/openapi/v1/remesh',
      payload,
      { headers }
    );
    console.log(response.data);
    res.json(response.data);
  } catch (error) {
    console.error(error);
  }
});
export default router;
