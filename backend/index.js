require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const axios = require("axios"); // axios 추가
const cheerio = require("cheerio"); // cheerio 추가
const { analyzeResumeWithVertexAIStream } = require("./vertexAIHandler"); // 스트리밍 함수로 변경
const { eq } = require("drizzle-orm"); // eq import 추가
const puppeteer = require("puppeteer"); // puppeteer 다시 사용
const { marked } = require("marked"); // marked 다시 사용
const fs = require("fs"); // fs 모듈 추가 (임시 파일 생성/삭제용)
const path = require("path"); // path 모듈 추가 (임시 파일 경로용)
// TypeScript 컴파일 후 생성되는 .js 파일을 명시적으로 가리키도록 경로 수정 시도
// 또는, package.json의 "main" 필드나 export 설정을 따를 수 있음
// 일반적으로 ./db/index.ts -> ./db/index.js 로 컴파일됨
const { db } = require("./db/index");
const { resumesTable } = require("./db/schema");

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// URL에서 텍스트를 가져오는 함수
async function fetchAndExtractTextFromUrl(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    const $ = cheerio.load(data);
    $(
      "script, style, noscript, iframe, img, svg, header, footer, nav, aside"
    ).remove();
    let text = $("body").text();
    text = text.replace(/\s\s+/g, " ").trim();
    console.log(
      `Extracted text from ${url} (first 200 chars):`,
      text.substring(0, 200)
    );
    return text;
  } catch (error) {
    console.error(
      `Error fetching or extracting text from URL ${url}:`,
      error.message
    );
    return "";
  }
}

app.get("/", (req, res) => {
  res.send("Hello from AutoCV Backend!");
});

app.post("/api/upload", upload.single("resumeFile"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "파일이 업로드되지 않았습니다." });
  }

  const jobPostingUrl = req.body.jobPostingUrl || null;
  let clientFileName = req.file.originalname;
  if (req.body && req.body.encodedFileName) {
    try {
      clientFileName = decodeURIComponent(req.body.encodedFileName);
      console.log("Decoded file name from client:", clientFileName);
    } catch (e) {
      console.error("Error decoding fileName from client:", e);
    }
  }

  console.log("Received file in backend:");
  console.log("Multer's Original Name:", req.file.originalname);
  console.log("Client's (decoded) File Name:", clientFileName);
  console.log("Size:", req.file.size);
  console.log("MIME Type:", req.file.mimetype);

  const fileBuffer = req.file.buffer;
  let extractedText = "";

  try {
    if (req.file.mimetype === "application/pdf") {
      const data = await pdfParse(fileBuffer);
      extractedText = data.text;
    } else if (
      req.file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      req.file.mimetype === "application/msword"
    ) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      extractedText = result.value;
    } else {
      return res.status(400).json({
        error: "지원하지 않는 파일 형식입니다. PDF 또는 DOCX 파일을 업로드해주세요.",
        fileName: clientFileName,
        fileType: req.file.mimetype
      });
    }

    if (extractedText.trim() === "") {
      return res
        .status(400)
        .json({ error: "파일에서 텍스트를 추출할 수 없습니다.", fileName: clientFileName });
    }

    let jobPostingText = "";
    if (jobPostingUrl) {
      jobPostingText = await fetchAndExtractTextFromUrl(jobPostingUrl);
    }

    const stream = await analyzeResumeWithVertexAIStream(
      extractedText,
      jobPostingText
    );

    let fullResponseText = "";
    for await (const chunk of stream) {
      if (
        chunk &&
        chunk.candidates &&
        chunk.candidates[0] &&
        chunk.candidates[0].content &&
        chunk.candidates[0].content.parts &&
        chunk.candidates[0].content.parts[0]
      ) {
        fullResponseText += chunk.candidates[0].content.parts[0].text;
      }
    }

    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = fullResponseText.match(jsonRegex);
    if (match && match[1]) {
      fullResponseText = match[1];
    } else {
      console.warn("Vertex AI 스트리밍 응답에서 JSON 코드 블록을 찾지 못했습니다.");
    }

    const analysisResultString = fullResponseText;
    let savedResumeRecord;
    try {
      const [insertedRecord] = await db
        .insert(resumesTable)
        .values({
          fileName: clientFileName,
          originalContent: extractedText,
          generatedMarkdown: analysisResultString,
          userId: null
        })
        .returning();
      savedResumeRecord = insertedRecord;
      console.log("이력서 정보가 DB에 저장되었습니다:", savedResumeRecord);
    } catch (dbError) {
      console.error("DB 저장 중 오류 발생:", dbError);
    }

    res.json({
      message: "파일 분석 및 정보 저장이 완료되었습니다.",
      fileName: clientFileName,
      analysis: JSON.parse(analysisResultString),
      dbRecordId: savedResumeRecord ? savedResumeRecord.id : null
    });
  } catch (error) {
    console.error("Error processing file or calling Vertex AI:", error);
    res
      .status(500)
      .json({ error: error.message || "파일 처리 또는 AI 분석 중 오류가 발생했습니다." });
  }
});

app.post("/api/download-pdf", async (req, res) => {
  const { markdownContent, fileName = "resume" } = req.body;

  if (
    !markdownContent ||
    typeof markdownContent !== "string" ||
    !markdownContent.trim()
  ) {
    return res.status(400).json({ error: "PDF로 변환할 마크다운 내용이 없습니다." });
  }

  const pdfFileName = `${fileName}_${Date.now()}.pdf`;
  const tempPdfPath = path.join(require("os").tmpdir(), pdfFileName);

  try {
    const htmlContent = marked(markdownContent);

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    await page.setContent(
      `<div style="padding: 20px; font-family: Arial, sans-serif;">${htmlContent}</div>`,
      {
        waitUntil: "networkidle0"
      }
    );

    await page.pdf({
      path: tempPdfPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        right: "20mm",
        bottom: "20mm",
        left: "20mm"
      }
    });
    await browser.close();
    console.log("PDF 생성 완료 (Puppeteer):", tempPdfPath);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(pdfFileName)}"`
    );
    res.setHeader("Content-Type", "application/pdf");

    const fileStream = fs.createReadStream(tempPdfPath);
    fileStream.pipe(res);

    fileStream.on("end", () => {
      fs.unlink(tempPdfPath, unlinkErr => {
        if (unlinkErr)
          console.error("임시 PDF 파일 삭제 중 오류 (Puppeteer):", unlinkErr);
        else console.log("임시 PDF 파일 삭제 완료 (Puppeteer):", tempPdfPath);
      });
    });
    fileStream.on("error", streamErr => {
      console.error("PDF 파일 스트리밍 중 오류 (Puppeteer):", streamErr);
      if (!res.headersSent) {
        res.status(500).json({ error: "PDF 파일 전송 중 오류가 발생했습니다." });
      }
      fs.unlink(tempPdfPath, () => {});
    });
  } catch (error) {
    console.error("PDF 변환/전송 중 오류 (Puppeteer):", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: error.message || "PDF 변환 또는 전송 중 오류가 발생했습니다." });
    }
    if (fs.existsSync(tempPdfPath)) {
      fs.unlink(tempPdfPath, () => {});
    }
  }
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});

// 추가 최적화 요청을 위한 새로운 엔드포인트
app.post("/api/refine", async (req, res) => {
  const {
    dbRecordId,
    userFeedback,
    previousAnalysis,
    fileName,
    jobPostingUrl
  } = req.body;

  if (!userFeedback || !userFeedback.trim()) {
    return res.status(400).json({ error: "피드백 내용이 없습니다." });
  }

  let resumeTextToRefine = "";
  let jobPostingTextToRefine = "";

  if (dbRecordId) {
    try {
      const record = await db
        .select()
        .from(resumesTable)
        .where(eq(resumesTable.id, dbRecordId))
        .limit(1);
      if (record && record.length > 0) {
        resumeTextToRefine = record[0].originalContent;
        if (jobPostingUrl) {
          jobPostingTextToRefine = await fetchAndExtractTextFromUrl(
            jobPostingUrl
          );
        }
      } else {
        return res.status(404).json({ error: "원본 이력서 정보를 찾을 수 없습니다." });
      }
    } catch (dbError) {
      console.error("DB 조회 중 오류 발생 (refine):", dbError);
      return res.status(500).json({ error: "DB 조회 중 오류가 발생했습니다." });
    }
  } else if (previousAnalysis && previousAnalysis.originalContent) {
    resumeTextToRefine = previousAnalysis.originalContent;
    if (jobPostingUrl) {
      jobPostingTextToRefine = await fetchAndExtractTextFromUrl(jobPostingUrl);
    }
  } else {
    return res.status(400).json({ error: "분석할 원본 이력서 내용이 필요합니다." });
  }

  try {
    const combinedTextForRefinement = `
      [원본 이력서 내용]:
      ${resumeTextToRefine}

      [이전 AI 분석 결과]:
      ${JSON.stringify(previousAnalysis, null, 2)}
      
      [사용자 추가 요청/피드백]:
      ${userFeedback}
    `;

    const stream = await analyzeResumeWithVertexAIStream(
      combinedTextForRefinement,
      jobPostingTextToRefine
    );

    let fullResponseText = "";
    for await (const chunk of stream) {
      if (
        chunk &&
        chunk.candidates &&
        chunk.candidates[0] &&
        chunk.candidates[0].content &&
        chunk.candidates[0].content.parts &&
        chunk.candidates[0].content.parts[0]
      ) {
        fullResponseText += chunk.candidates[0].content.parts[0].text;
      }
    }

    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = fullResponseText.match(jsonRegex);
    if (match && match[1]) {
      fullResponseText = match[1];
    } else {
      console.warn("Vertex AI 스트리밍 (refine) 응답에서 JSON 코드 블록을 찾지 못했습니다.");
    }

    res.json({
      message: "이력서 추가 최적화가 완료되었습니다.",
      fileName:
        fileName ||
        (dbRecordId ? `refined_resume_${dbRecordId}` : "refined_resume"),
      analysis: JSON.parse(fullResponseText)
    });
  } catch (error) {
    console.error("Error refining resume with Vertex AI:", error);
    res
      .status(500)
      .json({ error: error.message || "이력서 추가 최적화 중 오류가 발생했습니다." });
  }
});
