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
const units = require("./routes/Products/units");
const states = require("./routes/contacts/states");
const registration_type = require("./routes/contacts/registration_types");
const customers = require("./routes/contacts/customers");
const source_types = require("./routes/accounting/source_types");
const sales_invoices = require("./routes/accounting/sales/sales_invoice");
const expenes = require("./routes/accounting/expenses/expenses");
const expense_categories = require("./routes/accounting/expenses/expense_categories");
const payment_modes = require("./routes/accounting/payment_modes");
const transaction_types = require("./routes/accounting/transaction_types");


app.use("/login", login);
app.use("/api/employees", employee);
app.use("/api/products", products);
app.use("/api/units", units);
app.use("/api/states", states);
app.use("/api/registration_type", registration_type);
app.use("/api/customers", customers);
app.use("/api/source_types",source_types );
app.use("/api/sales_invoices",sales_invoices);
app.use("/api/expenes",expenes);
app.use("/api/expense_categories",expense_categories);
app.use("/api/payment_modes",payment_modes);
app.use("/api/transaction_types",transaction_types);
// Basic Test Route
app.get("/", (req, res) => {
  res.json({ status: "active", message: "Accounting API is running" });
});

app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});
