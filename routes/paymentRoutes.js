import express from "express";
import { PayOS } from "@payos/node";
import dotenv from "dotenv";
import mysqlPool from "../db/mysqlPool.js";

dotenv.config();

const router = express.Router();
const payOS = new PayOS(process.env.PAYOS_CLIENT_ID, process.env.PAYOS_API_KEY, process.env.PAYOS_CHECKSUM_KEY);

const generateOrderCode = () => {
  return Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`); 
};

//ADD new bank payment and handel bank payment
router.post("/create_bank_payment", async (req, res) => {
  try {
    const { order_id, payment_method, amount, items } = req.body;

    if (!amount || !order_id) {
      return res.status(400).json({ message: "Missing order_id or amount" });
    }

    //Generate order code
    const newGenOC = generateOrderCode();

    //Prepare PayOS payment data
    const paymentData = {
      orderCode: newGenOC,
      amount: amount,
      description: `TS${newGenOC}`,
      returnUrl: "https://fulminous-noncontemporaneously-laci.ngrok-free.dev/api/payment_success",
      cancelUrl: "https://fulminous-noncontemporaneously-laci.ngrok-free.dev/api/payment_cancel",
      items: items,
    };

    //Create payment via PayOS API
    const response = await payOS.paymentRequests.create(paymentData);
    const paymentUrl = response.checkoutUrl;

    //Save to database
    const sql = `
      INSERT INTO payment_info (order_id, payment_method, payment_status, order_code)
      VALUES (?, ?, ?, ?)
    `;
    mysqlPool.query(sql, [order_id, payment_method, "Pending", newGenOC], (err) => {
      if (err) {
        console.error("Insert error:", err);
        return res.status(500).json({ message: "Database insert failed" });
      }

      //Return final response (only once)
      res.status(200).json({
        status_code: 200,
        message: "Payment created successfully",
        payment_url: paymentUrl,
        order_code: newGenOC,
      });
    });
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({
      message: "Failed to create payment",
      error: error.message,
    });
  }
});

//Payment success
router.get("/payment_success", async (req, res) => {
  try {
    const orderCode = req.query.orderCode; // PayOS sends orderCode back
    
    const updatePayment = `UPDATE payment_info SET payment_status = 'Completed' WHERE order_code = ?`;
    mysqlPool.query(updatePayment, [orderCode], (err) => {
      if (err) {
        console.error("Error updating payment:", err);
        return res.redirect("toystoreapp://home?status=error");
      }
      
      // Also update the related order status
      const updateOrder = `
        UPDATE orders 
        SET order_status = 'Shipping', shipped_date = NOW() 
        WHERE order_id = (
          SELECT order_id FROM payment_info WHERE order_code = ?
        )
      `;

      mysqlPool.query(updateOrder, [orderCode], (orderErr) => {
        if (orderErr) {
          console.error("Error updating orders:", orderErr);
          return res.redirect("toystoreapp://home?status=error");
        }

        // Redirect back to your Flutter app
        res.redirect("toystoreapp://home?status=success");
      });
    });
  } catch (error) {
    console.error("Error on payment_success:", error);
    res.redirect("toystoreapp://home?status=error");
  }
});

//Payment canceled
router.get("/payment_cancel", async (req, res) => {
  try {
    const orderCode = req.query.orderCode; // PayOS sends orderCode back

    const sql = `UPDATE payment_info SET payment_status = 'Cancelled' WHERE order_code = ?`;
    mysqlPool.query(sql, [orderCode], (err) => {
      if (err) {
        console.error("Error updating payment:", err);
        return res.redirect("toystoreapp://home?status=error");
      }

     // Also mark the order as cancelled
      const updateOrder = `
        UPDATE orders 
        SET order_status = 'Cancelled'  
        WHERE order_id = (
          SELECT order_id FROM payment_info WHERE order_code = ?
        )
      `;

      mysqlPool.query(updateOrder, [orderCode], (orderErr) => {
        if (orderErr) {
          console.error("Error updating orders:", orderErr);
          return res.redirect("toystoreapp://home?status=error");
        }

        res.redirect("toystoreapp://home?status=cancelled");
      });
    });
  } catch (error) {
    console.error("Error on payment_cancel:", error);
    res.redirect("toystoreapp://home?status=error");
  }
});

//ADD new cash payment
router.post("/create_cash_payment", async (req, res) => {
  try {
    const { order_id, payment_method, amount} = req.body;

    if (!amount || !order_id) {
      return res.status(400).json({ message: "Missing order_id or amount" });
    }

    //Generate order code
    const newGenOC = generateOrderCode();

    //Save to database
    const sql = `
      INSERT INTO payment_info (order_id, payment_method, payment_status, order_code)
      VALUES (?, ?, ?, ?)
    `;
    mysqlPool.query(sql, [order_id, payment_method, "Pending", newGenOC], (err) => {
      if (err) {
        console.error("Insert error:", err);
        return res.status(500).json({ message: "Database insert failed" });
      }

      res.status(200).json({
        status_code: 200,
        message: "Payment created successfully",
        order_code: newGenOC,
      });
    });
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({
      message: "Failed to create payment",
      error: error.message,
    });
  }
});

export default router;
