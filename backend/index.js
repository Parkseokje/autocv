require("dotenv").config();
const express = require("express");
const cors = require("cors");
const resumeRoutes = require("./routes/resumeRoutes"); // 라우트 모듈 import

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 기본 경로 핸들러
app.get("/", (req, res) => {
  res.send("Hello from AutoCV Backend!");
});

// API 라우트 등록
// resumeRoutes.js에서 /upload, /refine 등으로 이미 경로가 정의되어 있으므로,
// 여기서는 /api를 기본 경로로 사용합니다.
// 예: /api/upload, /api/refine
app.use("/api", resumeRoutes);

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
