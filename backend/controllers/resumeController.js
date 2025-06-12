const { v4: uuidv4 } = require("uuid");
const { fetchAndExtractTextFromUrl } = require("../utils/textExtractor");
const { parseResumeFile } = require("../utils/fileParser");
const { db } = require("../db/index");
const { resumesTable } = require("../db/schema");
const { eq } = require("drizzle-orm");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const aiService = require("../services/aiService");
const pdfService = require("../services/pdfService");

const cancelOperation = (req, res) => {
  logger.info(`[Controller] cancelOperation 호출됨. Request body:`, req.body); // 컨트롤러 진입 로그
  const { operationId } = req.body;
  if (!operationId) {
    logger.warn("[Controller] cancelOperation: operationId가 요청 body에 없습니다.");
    return res
      .status(400)
      .json({ message: "operationId가 필요합니다.", success: false });
  }
  const result = aiService.cancelOperationById(operationId);
  logger.info(
    `[Controller] cancelOperation: aiService.cancelOperationById 결과:`,
    result
  );
  res
    .status(result.status)
    .json({ message: result.message, success: result.success });
};

const initiateAnalysis = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "파일이 업로드되지 않았습니다." });
  }

  const jobPostingUrl = req.body.jobPostingUrl || null;
  let clientFileName = req.file.originalname;
  if (req.body && req.body.encodedFileName) {
    try {
      clientFileName = decodeURIComponent(req.body.encodedFileName);
      logger.info(
        `[Controller] initiateAnalysis: Decoded clientFileName: ${clientFileName}`
      );
    } catch (e) {
      logger.warn(
        "Error decoding fileName from client (initiateAnalysis):",
        e,
        "Original encodedFileName:",
        req.body.encodedFileName
      );
    }
  } else {
    logger.info(
      `[Controller] initiateAnalysis: Using originalname: ${clientFileName}`
    );
  }

  try {
    const extractedText = await parseResumeFile(req.file);
    let jobPostingText = "";
    if (jobPostingUrl) {
      jobPostingText = await fetchAndExtractTextFromUrl(jobPostingUrl);
    }

    const operationId = aiService.initiateAnalysisOperation({
      extractedText,
      jobPostingText,
      clientFileName
    });

    try {
      await db.insert(resumesTable).values({
        id: operationId,
        fileName: clientFileName,
        originalContent: extractedText,
        status: "initiated",
        userId: null
      });
      logger.info(`[${operationId}] 초기 분석 정보 DB 저장됨.`);
    } catch (dbError) {
      logger.error(`[${operationId}] 초기 분석 정보 DB 저장 중 오류:`, dbError);
    }

    res.status(200).json({
      success: true,
      operationId: operationId,
      fileName: clientFileName
    });
  } catch (error) {
    logger.error(`Error in initiateAnalysis controller:`, error);
    if (error.unsupportedFileType || error.emptyExtraction) {
      return res.status(400).json({
        error: error.message,
        fileName: error.fileName,
        fileType: error.fileType
      });
    }
    res.status(500).json({ error: error.message || "분석 작업 초기화 중 오류가 발생했습니다." });
  }
};

const streamAnalysisEvents = async (req, res) => {
  const { operationId } = req.query;
  logger.info(
    `[Controller] streamAnalysisEvents 호출됨. Operation ID: ${operationId}`
  ); // 컨트롤러 진입 로그

  if (!operationId) {
    res.setHeader("Content-Type", "text/event-stream");
    res.status(400).write(
      `event: error\ndata: ${JSON.stringify({
        error: "operationId가 필요합니다."
      })}\n\n`
    );
    res.end();
    return;
  }

  try {
    await aiService.handleAnalysisSSE(req, res, operationId);
  } catch (serviceError) {
    logger.error(
      `[${operationId}] streamAnalysisEvents: handleAnalysisSSE 호출 중 예외 발생:`,
      serviceError
    );
    if (!res.writableEnded) {
      try {
        res.write(
          `event: error\ndata: ${JSON.stringify({
            error: "내부 서버 오류로 분석 스트리밍을 시작할 수 없습니다."
          })}\n\n`
        );
      } catch (e) {
        logger.error("Error writing final error to SSE stream:", e);
      }
      res.end();
    }
  }
};

const uploadResume = async (req, res) => {
  res.status(501).json({
    message:
      "This endpoint is deprecated. Use /initiate-analysis and /stream-analysis."
  });
};

const refineResume = async (req, res) => {
  const { operationId, section, userInput, previousMarkdown } = req.body; // previousMarkdown 추가

  if (!operationId || !section || !userInput) {
    logger.warn(
      "[Controller] refineResume: 필수 파라미터 누락 (operationId, section, userInput). Body:",
      req.body
    );
    return res.status(400).json({
      success: false,
      message: "operationId, section, userInput은 필수 요청 값입니다."
    });
  }

  logger.info(
    `[Controller] refineResume 호출됨. Operation ID: ${operationId}, Section: ${section}, PreviousMarkdown Exists: ${!!previousMarkdown}`
  );

  try {
    const result = aiService.prepareForRefinement(
      operationId,
      section,
      userInput,
      previousMarkdown // previousMarkdown 전달
    );
    logger.info(
      `[Controller] refineResume: aiService.prepareForRefinement 결과:`,
      result
    );
    return res.status(result.status).json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    logger.error(
      `[Controller] refineResume (${operationId}): aiService.prepareForRefinement 호출 중 예외 발생:`,
      error
    );
    return res.status(500).json({
      success: false,
      message: "개선 요청 처리 중 서버 내부 오류가 발생했습니다."
    });
  }
};

const downloadPdf = async (req, res) => {
  const { markdownContent, fileName = "resume" } = req.body;
  try {
    const tempPdfPath = await pdfService.generatePdfFromMarkdown(
      markdownContent,
      fileName
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(tempPdfPath)}"`
    );
    res.setHeader("Content-Type", "application/pdf");
    const fileStream = fs.createReadStream(tempPdfPath);
    fileStream.pipe(res);
    fileStream.on("end", () => {
      fs.unlink(tempPdfPath, unlinkErr => {
        if (unlinkErr) logger.error("임시 PDF 파일 삭제 중 오류 (컨트롤러):", unlinkErr);
        else logger.info("임시 PDF 파일 삭제 완료 (컨트롤러):", tempPdfPath);
      });
    });
    fileStream.on("error", streamErr => {
      logger.error("PDF 파일 스트리밍 중 오류 (컨트롤러):", streamErr);
      if (!res.headersSent)
        res.status(500).json({ error: "PDF 파일 전송 중 오류가 발생했습니다." });
      fs.unlink(tempPdfPath, () => {});
    });
  } catch (error) {
    logger.error("PDF 변환/전송 중 오류 (컨트롤러):", error);
    if (!res.headersSent)
      res
        .status(500)
        .json({ error: error.message || "PDF 변환 또는 전송 중 오류가 발생했습니다." });
  }
};

module.exports = {
  cancelOperation,
  initiateAnalysis,
  streamAnalysisEvents,
  uploadResume,
  refineResume,
  downloadPdf
};
