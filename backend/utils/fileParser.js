const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

async function parseResumeFile(file) {
  if (!file || !file.buffer || !file.mimetype) {
    throw new Error("Invalid file object provided for parsing.");
  }

  const fileBuffer = file.buffer;
  let extractedText = "";

  if (file.mimetype === "application/pdf") {
    const data = await pdfParse(fileBuffer);
    extractedText = data.text;
  } else if (
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.mimetype === "application/msword"
  ) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    extractedText = result.value;
  } else {
    const error = new Error("지원하지 않는 파일 형식입니다. PDF 또는 DOCX 파일을 업로드해주세요.");
    error.unsupportedFileType = true; // 사용자 정의 속성으로 오류 유형 구분
    error.fileName = file.originalname;
    error.fileType = file.mimetype;
    throw error;
  }

  if (extractedText.trim() === "") {
    const error = new Error("파일에서 텍스트를 추출할 수 없습니다.");
    error.emptyExtraction = true; // 사용자 정의 속성
    error.fileName = file.originalname;
    throw error;
  }

  return extractedText;
}

module.exports = { parseResumeFile };
