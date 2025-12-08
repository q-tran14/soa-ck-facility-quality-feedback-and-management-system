require("dotenv").config();
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path");
const cors = require("cors");
const router = require("./routes/routes");
const mediaRoutes = require("./routes/mediaRoute");

const { connectDB } = require("./configs/database");
const openurl = require("openurl");

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());

connectDB();

// Swagger config
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "General Service API",
      version: "1.0.0",
      description: "API documentation for the General service",
    }
  },
  // Nơi chứa các file có comment Swagger
  apis: ["./routes/*.js"],
};

// Sinh ra spec JSON
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// API endpoint để merge docs
app.get("/docs-json", (req, res) => {
  res.json(swaggerSpec);
});

// Swagger UI — dùng file JSON đã merge
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(null, {
    swaggerOptions: {
      url: "/docs-json", // load tài liệu từ endpoint merge
      defaultModelsExpandDepth: -1, // Ẩn phần Schemas
    },
    customSiteTitle: "General Service API Docs",
    customCss: `
      .swagger-ui .topbar { display: none !important; }
      .swagger-ui .topbar-wrapper .link span {
        color: #fff !important;
        font-weight: bold;
        font-size: 20px;
      }
      .swagger-ui .topbar-wrapper .link img { display: none; }
    `,
  })
);

// Routes
app.use("/api", router);
app.use("/api/media", mediaRoutes);


const isDev = process.env.NODE_ENV === "development";

app.listen(port, () => {
  const docsUrl = `${process.env.API_BASE_URL}/docs`;
  console.log(`General API Docs is running on ${docsUrl}`);

  if (isDev) {
    try {
      openurl.open(docsUrl);
    } catch (err) {
      console.error("Không mở được browser:", err);
    }
  }
});
