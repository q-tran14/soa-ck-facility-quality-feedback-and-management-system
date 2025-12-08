require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./configs/db");
const routes = require("./routes/routes"); 
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./configs/swagger");

const app = express();
app.use(cors());
app.use(express.json());

// connect Mongo
connectDB();

// routes API
app.use("/api", routes);

// health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Task-Management-Service" });
});

// endpoint docs-json 
app.get("/docs-json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// trang UI swagger
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Task Management Service API", // tên m muốn
  })
);


const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Task-Management-Service running on port ${PORT}`);
});

