const axios = require("axios");
const cheerio = require("cheerio");
const logger = require("./logger");

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
    logger.info(
      `Extracted text from ${url} (first 200 chars):`,
      text.substring(0, 200)
    );
    return text;
  } catch (error) {
    logger.error(
      `Error fetching or extracting text from URL ${url}:`,
      error.message
    );
    // 에러 발생 시 빈 문자열 대신 에러를 다시 던지거나, null을 반환하는 것을 고려할 수 있습니다.
    // 호출하는 쪽에서 에러 처리를 더 명확하게 할 수 있도록 합니다.
    // 여기서는 기존 로직대로 빈 문자열을 반환합니다.
    return "";
  }
}

module.exports = { fetchAndExtractTextFromUrl };
