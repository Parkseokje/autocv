const log = require("loglevel");

/**
 * 백엔드 애플리케이션을 위한 로거 인스턴스.
 *
 * 개발 환경에서는 'debug' 레벨 이상의 모든 로그를 출력하고,
 * 프로덕션 환경에서는 'info' 레벨 이상의 로그만 출력합니다.
 *
 * 사용 예:
 * const logger = require('./utils/logger'); // 경로에 맞게 수정
 * logger.debug('디버그 메시지');
 * logger.info('정보 메시지');
 * logger.warn('경고 메시지');
 * logger.error('오류 메시지');
 */
const logger = log.getLogger("backend");

if (process.env.NODE_ENV === "development") {
  logger.setLevel("debug");
} else {
  logger.setLevel("info");
}

module.exports = logger;
