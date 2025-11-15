import authenticationRoutes from "./routes/authenticationRoutes.js"
import cartRoutes from "./routes/cartRoutes.js"
import orderRoutes from "./routes/orderRoutes.js"
import shoppingRoutes from "./routes/shoppingRoutes.js"
import paymentRoutes from "./routes/paymentRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"
import meshyaiRoutes from "./routes/meshyaiRoutes.js"
import express from "express"
import ngrok from '@ngrok/ngrok'

const app = express();

app.use("/images", express.static("E:/DACN/Document"));

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use("/api", authenticationRoutes);
app.use("/api", cartRoutes);
app.use("/api", orderRoutes);
app.use("/api", shoppingRoutes);
app.use("/api", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", meshyaiRoutes);

app.listen(2000, () => {
    console.log("Connected to server at 2000");
    // ngrok.connect({ addr: 2000, authtoken: process.env.NGROK_AUTHTOKEN })
	// .then(listener => console.log(`Ingress established at: ${listener.url()}`));
});
