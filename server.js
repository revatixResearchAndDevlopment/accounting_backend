const express = require("express");
const cors = require("cors");

require("dotenv").config();

const app = express();
const PORT = process.env.API_PORT || 3005;
const cookieParser = require("cookie-parser");
app.set("trust proxy", true);

const allowed_origins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) =>
      o.trim().replace(/['"\[\]]/g, "")
    )
  : [];

const cors_options = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowed_origins.indexOf(origin) === -1) {
      const msg =
        "The CORS policy for this site does not allow access from the specified Origin.";
      console.error(`Blocked by CORS: ${origin}`);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: "GET,POST,PUT,DELETE,OPTIONS,HEAD,PATCH",
  credentials: true,
};

app.use(cors(cors_options));
app.use(cookieParser());

const login = require("./routes/login");
const employee = require("./routes/team_management/employees");
const products = require("./routes/Products/products");

app.use("/login", login);
app.use("/api/employees", employee);
app.use("/api/products", products);
// Basic Test Route
app.get("/", (req, res) => {
  res.json({ status: "active", message: "Accounting API is running" });
});

app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});
