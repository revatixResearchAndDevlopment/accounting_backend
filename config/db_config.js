const mysql = require("mysql2");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: process.env.WAIT_FOR_CONNECTIONS,
  connectionLimit: process.env.CONNECTION_LIMIT,
  queueLimit: process.env.QUEUE_LIMIT,
});
module.exports = pool.promise();
