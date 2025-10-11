import authenticationRoutes from "./routes/authenticationRoutes.js"
import cartRoutes from "./routes/cartRoutes.js"
import orderRoutes from "./routes/orderRoutes.js"
import shoppingRoutes from "./routes/shoppingRoutes.js"
import express from "express"

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

app.listen(2000, () => {
    console.log("Connected to server at 2000");
});
