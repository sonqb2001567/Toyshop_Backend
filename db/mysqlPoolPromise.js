import mysql from "mysql2/promise";

const mysqlPoolPromise = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "bimqb2001",
  database: "datn",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default mysqlPoolPromise;
