const conn = require("mysql2");

const mysqlPool = conn.createPool({
    host: "localhost",
    user: "root",
    password: "bimqb2001",
    database: "datn",
    connectionLimit: 10
})

export default mysqlPool;