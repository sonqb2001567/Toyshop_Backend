import admin from "firebase-admin";
import { readFileSync } from "fs";


const serviceAccount = JSON.parse(
  readFileSync("./artoyshop-firebase-adminsdk-fbsvc-9898dff65a.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "artoyshop.firebasestorage.app",
});

const bucket = admin.storage().bucket();

export { bucket };
