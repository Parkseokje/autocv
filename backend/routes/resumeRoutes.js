const express = require("express");
const multer = require("multer");
const resumeController = require("../controllers/resumeController");

const router = express.Router();

// Multer 설정 (파일 업로드를 위해)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 새로운 분석 작업 초기화 요청 (파일 업로드 + operationId 반환)
router.post(
  "/initiate-analysis",
  upload.single("resumeFile"),
  resumeController.initiateAnalysis
);

// SSE를 통한 이력서 분석 스트리밍 요청 (operationId 필요)
router.get("/stream-analysis", resumeController.streamAnalysisEvents);

// 분석된 이력서 PDF 다운로드 요청
router.post("/download-pdf", resumeController.downloadPdf);

// 진행 중인 작업 취소 요청
router.post("/cancel-operation", resumeController.cancelOperation);

// 이력서 개선 요청 API (프론트엔드의 handleRefineRequest에서 호출)
router.post("/refine-analysis", resumeController.refineResume);

// 기존 /upload 및 /refine 라우트는 deprecated 되었으므로 제거합니다.
// router.post("/upload", upload.single("resumeFile"), resumeController.uploadResume);
// router.post("/refine", resumeController.refineResume);

module.exports = router;
