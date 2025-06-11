const puppeteer = require("puppeteer");
const { marked } = require("marked");
const fs = require("fs");
const path = require("path");

/**
 * 마크다운 내용을 HTML로 변환하고, Puppeteer를 사용하여 PDF 파일로 생성합니다.
 * 생성된 PDF 파일의 임시 경로를 반환합니다.
 * @param {string} markdownContent - PDF로 변환할 마크다운 문자열
 * @param {string} baseFileName - 생성될 PDF 파일의 기본 이름 (확장자 제외)
 * @returns {Promise<string>} 생성된 PDF 파일의 임시 경로
 * @throws {Error} PDF 생성 중 오류 발생 시
 */
async function generatePdfFromMarkdown(
  markdownContent,
  baseFileName = "resume"
) {
  if (
    !markdownContent ||
    typeof markdownContent !== "string" ||
    !markdownContent.trim()
  ) {
    throw new Error("PDF로 변환할 마크다운 내용이 없습니다.");
  }

  const pdfFileName = `${baseFileName}_${Date.now()}.pdf`;
  const tempPdfPath = path.join(require("os").tmpdir(), pdfFileName);

  let browser;
  try {
    const htmlContent = marked(markdownContent);

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    await page.setContent(
      // 기본 스타일 추가하여 가독성 향상
      `<style>body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; } h1, h2, h3 { margin-bottom: 0.5em; } ul, ol { padding-left: 20px; } blockquote { border-left: 3px solid #eee; padding-left: 10px; color: #666; margin-left: 0; } code { background-color: #f5f5f5; padding: 2px 4px; border-radius: 3px; } pre { background-color: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; } table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } hr { border: none; border-top: 1px solid #eee; margin: 1em 0; }</style>` +
        `<div>${htmlContent}</div>`,
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

    console.log("PDF 서비스: PDF 생성 완료 -", tempPdfPath);
    return tempPdfPath;
  } catch (error) {
    console.error("PDF 서비스: PDF 생성 중 오류:", error);
    // 오류 발생 시 생성된 임시 파일이 있다면 삭제 시도
    if (fs.existsSync(tempPdfPath)) {
      try {
        fs.unlinkSync(tempPdfPath);
      } catch (unlinkErr) {
        console.error("PDF 서비스: 오류 후 임시 PDF 파일 삭제 실패:", unlinkErr);
      }
    }
    throw error; // 오류를 다시 던져 호출부에서 처리
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generatePdfFromMarkdown };
