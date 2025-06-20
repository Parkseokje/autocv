const { v4: uuidv4 } = require("uuid");
const { analyzeResumeWithVertexAIStream } = require("../vertexAIHandler");
const { db } = require("../db/index"); // db import 추가
const { resumesTable } = require("../db/schema"); // resumesTable import 추가
const { eq } = require("drizzle-orm"); // eq import 추가
const logger = require('../utils/logger');

// operationId -> { stream?: VertexAIStream, response?: ExpressResponse, requestData?: any, sseStarted?: boolean, abortController?: AbortController, refinementDetails?: { section: string, userInput: string, previousMarkdown?: string } | null }
const activeConnections = new Map();

const initiateAnalysisOperation = (initialData) => {
  const operationId = uuidv4();
  const abortController = new AbortController(); // AbortController 생성
  activeConnections.set(operationId, {
    requestData: initialData,
    stream: null,
    response: null,
    sseStarted: false,
    abortController: abortController, // abortController 저장
    refinementDetails: null, // refinementDetails 초기화
  });
  logger.info(`[${operationId}] AI 서비스: 분석 작업 초기화됨. 데이터, AbortController 및 refinementDetails 저장됨.`);
  return operationId;
};

const getStoredAnalysisData = (operationId) => {
  const connection = activeConnections.get(operationId);
  return connection?.requestData || null;
};

const prepareForRefinement = (operationId, section, userInput, previousMarkdown) => { // previousMarkdown 인자 추가
  // previousMarkdown은 없을 수도 있으므로, userInput까지만 필수 체크
  if (!operationId || !section || !userInput) { 
    logger.warn(`[${operationId}] AI 서비스: prepareForRefinement - 필수 파라미터 누락 (operationId, section, userInput).`);
    return { success: false, message: "operationId, section, userInput은 필수입니다.", status: 400 };
  }

  const connection = activeConnections.get(operationId);
  if (!connection) {
    logger.warn(`[${operationId}] AI 서비스: prepareForRefinement - activeConnections에 해당 ID 없음.`);
    return { success: false, message: "활성 분석 세션을 찾을 수 없습니다.", status: 404 };
  }

  logger.info(`[${operationId}] AI 서비스: 개선 요청 준비 시작. Section: ${section}, UserInput: ${userInput}, PreviousMarkdown provided: ${!!previousMarkdown}`);
  connection.refinementDetails = { section, userInput, previousMarkdown }; // previousMarkdown 추가

  // 현재 진행 중인 스트림이 있다면 중단
  if (connection.abortController && !connection.abortController.signal.aborted) {
    logger.info(`[${operationId}] AI 서비스: prepareForRefinement - 기존 스트림 중단을 위해 AbortController.abort() 호출.`);
    connection.abortController.abort();
    // AbortController를 새로 만들어서 교체해야 다음 SSE 연결 시 새 스트림을 받을 수 있음
    connection.abortController = new AbortController(); 
  } else if (connection.abortController && connection.abortController.signal.aborted) {
    logger.info(`[${operationId}] AI 서비스: prepareForRefinement - 기존 AbortController가 이미 aborted 상태. 새 AbortController 생성.`);
    connection.abortController = new AbortController();
  }


  activeConnections.set(operationId, connection);
  logger.info(`[${operationId}] AI 서비스: refinementDetails 업데이트 및 기존 스트림 중단 시도 완료.`);
  return { success: true, message: "개선 요청이 접수되었으며, 기존 스트림이 중단되었습니다. SSE 연결을 재시도하세요.", status: 200 };
};

const cancelOperationById = (operationId) => {
  if (!operationId) {
    return { success: false, message: "operationId가 필요합니다.", status: 400 };
  }

  const connection = activeConnections.get(operationId);
  if (!connection) {
    logger.info(`[${operationId}] AI 서비스: cancelOperationById - 취소 요청 시 activeConnections에 해당 ID 없음 (이미 처리되었거나 유효하지 않은 ID).`);
    return { success: true, message: "작업을 찾을 수 없거나 이미 취소/완료되었습니다.", status: 404 };
  }

  logger.info(`[${operationId}] AI 서비스: 작업 취소 요청 처리 시작 (cancelOperationById).`);
  let abortCalled = false;
  let responseEnded = false;

  try {
    if (connection.abortController) {
      connection.abortController.abort(); // AbortController를 사용하여 작업 취소
      abortCalled = true;
      logger.info(`[${operationId}] AI 서비스: AbortController.abort() 호출됨.`);
    } else {
      logger.warn(`[${operationId}] AI 서비스: AbortController가 connection 객체에 없음.`);
    }

    // 기존 stream.cancel/destroy 로직은 AbortController로 대체되므로 제거 또는 주석 처리
    // if (connection.stream) { ... }

    if (connection.response && !connection.response.writableEnded) {
      try {
        // 클라이언트에게 작업이 취소되었음을 알리는 메시지를 보낼 수 있습니다.
        // 다만, abort() 호출로 인해 스트림이 이미 닫혔을 수 있으므로 주의해야 합니다.
        // EventSource는 연결이 끊어지면 자동으로 재연결을 시도할 수 있으므로, 
        // 명시적인 에러 메시지 전송이 항상 필요하지 않을 수 있습니다.
        // 여기서는 연결을 그냥 닫는 것으로 처리합니다.
        connection.response.end(); // SSE 연결 종료
        responseEnded = true;
        logger.info(`[${operationId}] AI 서비스: SSE 연결 명시적으로 종료 시도됨 (취소).`);
      } catch (e) {
        logger.error(`[${operationId}] AI 서비스: SSE 응답 종료 중 오류:`, e);
      }
    } else {
      logger.info(`[${operationId}] AI 서비스: 취소 시점에 SSE 응답 객체가 없거나 이미 종료됨.`);
    }
  } catch (error) {
    logger.error(`[${operationId}] AI 서비스: 작업 취소 로직 실행 중 예외 발생:`, error);
  } finally {
    activeConnections.delete(operationId);
    logger.info(`[${operationId}] AI 서비스: activeConnections에서 제거 완료 (cancelOperationById).`);
  }
  
  return { 
    success: true, 
    message: `[${operationId}] 작업 취소 처리 시도됨 (Abort 호출 시도: ${abortCalled}, 응답 종료 시도: ${responseEnded}).`, 
    status: 200 
  };
};

// SSE 연결 초기화 및 유효성 검사 함수
function initializeSSEConnection(res, operationId) {
  let connection = activeConnections.get(operationId);

  if (!connection || !connection.requestData) {
    logger.error(`[${operationId}] AI 서비스: SSE 스트리밍 시작 실패 - 저장된 요청 데이터 없음 (initializeSSEConnection).`);
    if (res && !res.writableEnded) {
      res.setHeader("Content-Type", "text/event-stream");
      res.status(404).write(`event: error\ndata: ${JSON.stringify({ error: "Analysis session not found or not initiated." })}\n\n`);
      res.end();
    }
    activeConnections.delete(operationId);
    return null; 
  }

  if (connection.sseStarted && connection.response && !connection.response.writableEnded) {
    logger.warn(`[${operationId}] AI 서비스: SSE 스트리밍 중복 시작 시도 (initializeSSEConnection).`);
    if (res && !res.writableEnded) {
      res.setHeader("Content-Type", "text/event-stream");
      res.status(409).write(`event: error\ndata: ${JSON.stringify({ error: "Streaming already in progress for this operation." })}\n\n`);
      res.end();
    }
    return null; 
  }

  connection.response = res;
  connection.sseStarted = true;
  activeConnections.set(operationId, connection);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  return connection; 
}

// Vertex AI 스트림 가져오기 및 연결 정보 업데이트 함수
async function getVertexAIStream(extractedText, jobPostingText, operationId, res) {
  let vertexStream;
  const connection = activeConnections.get(operationId);
  if (!connection || !connection.abortController) {
    logger.error(`[${operationId}] AI 서비스: AbortController가 없어 Vertex AI 스트림을 가져올 수 없습니다.`);
    return null;
  }

  try {
    const refinementDetails = connection.refinementDetails; // 개선 요청 정보 가져오기
    // analyzeResumeWithVertexAIStream에 abortSignal 및 refinementDetails 전달
    vertexStream = await analyzeResumeWithVertexAIStream(
      extractedText,
      jobPostingText,
      connection.abortController.signal, // AbortSignal 전달
      refinementDetails // refinementDetails 전달
    );

    // connection 객체를 다시 가져와서 최신 상태 확인 (중요)
    let currentConnection = activeConnections.get(operationId);
    if (currentConnection && currentConnection.response && !currentConnection.response.writableEnded) { 
        currentConnection.stream = vertexStream; // 스트림 객체 저장 (필요하다면)
        activeConnections.set(operationId, currentConnection); 
        logger.info(`[${operationId}] AI 서비스: Vertex AI 스트림 생성 및 연결됨 (getVertexAIStream).`);
        return vertexStream;
    } else {
        logger.warn(`[${operationId}] AI 서비스: Vertex AI 스트림 생성 후 connection이 없거나 응답이 이미 종료됨 (getVertexAIStream).`);
        // 스트림이 생성되었으나 사용할 수 없는 경우, 여기서 직접 취소 시도 (만약 스트림 객체가 cancel을 지원한다면)
        // 하지만 AbortController를 사용하므로, 이 경우는 발생하지 않거나 다른 방식으로 처리될 수 있음.
        // if (vertexStream && typeof vertexStream.cancel === 'function') { // 이 부분은 AbortController 사용으로 불필요해질 수 있음
        //     vertexStream.cancel();
        // }
        return null; 
    }
  } catch (aiError) {
    // AbortError인 경우, 작업이 정상적으로 취소된 것이므로 오류로 간주하지 않을 수 있음
    if (aiError.name === 'AbortError') {
      logger.info(`[${operationId}] AI 서비스: Vertex AI 스트림 생성이 AbortController에 의해 중단됨 (getVertexAIStream).`);
      return null;
    }
    logger.error(`[${operationId}] AI 서비스: Vertex AI 스트림 생성 중 오류 (getVertexAIStream):`, aiError);
    return null;
  }
}

// Vertex AI 스트림 응답 처리 및 클라이언트로 청크 전송 함수
async function processAndStreamVertexResponse(vertexStream, res, operationId) {
  let fullResponseText = "";
  try {
    for await (const chunk of vertexStream) {
      const currentConnectionState = activeConnections.get(operationId);
      if (!currentConnectionState || !currentConnectionState.response || currentConnectionState.response.writableEnded) {
        logger.info(`[${operationId}] AI 서비스: 스트림 처리 중 작업 취소 또는 연결 종료 감지 (processAndStreamVertexResponse loop).`);
        return null; 
      }
      if (chunk?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const textPart = chunk.candidates[0].content.parts[0].text;
        fullResponseText += textPart;
        if (!res.writableEnded) res.write(`data: ${JSON.stringify({ chunk: textPart })}\n\n`);
      }
    }
    return fullResponseText; 
  } catch (streamError) {
    if (streamError.name === 'AbortError') {
      logger.info(`[${operationId}] AI 서비스: Vertex AI 스트림 처리가 AbortController에 의해 중단됨 (processAndStreamVertexResponse).`);
      return null; // 취소된 경우이므로 null 반환하여 정상 종료 처리 유도
    }
    logger.error(`[${operationId}] AI 서비스: Vertex AI 스트림 처리 중 오류 (processAndStreamVertexResponse):`, streamError);
    if (activeConnections.has(operationId) && res && !res.writableEnded) {
       res.write(`event: error\ndata: ${JSON.stringify({ error: `AI 스트림 처리 중 오류: ${streamError.message}` })}\n\n`);
    }
    return null; 
  }
}

// 최종 분석 결과 파싱 및 전송 함수
async function parseAndFinalizeAnalysis(fullResponseText, res, operationId) { // async 추가
  // AI가 생성한 전체 응답 텍스트 로깅
  logger.debug(`[${operationId}] AI 서비스: Vertex AI fullResponseText (before regex):\n---\n${fullResponseText}\n---`);

  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = fullResponseText.match(jsonRegex);
  let finalAnalysisData;

  if (match && match[1]) {
    const extractedJsonString = match[1];
    // 추출된 JSON 문자열 로깅
    logger.debug(`[${operationId}] AI 서비스: Extracted JSON string for parsing:\n---\n${extractedJsonString}\n---`);
    try {
      finalAnalysisData = JSON.parse(extractedJsonString);
    } catch (parseError) {
      logger.error(`[${operationId}] AI 서비스: 최종 JSON 파싱 오류 (parseAndFinalizeAnalysis):`, parseError);
      const problematicSubstring = extractedJsonString.substring(0, 200); 
      if (!res.writableEnded) res.write(`event: error\ndata: ${JSON.stringify({ error: `AI 응답 최종 처리 중 오류 발생 (JSON 파싱 실패). Problematic string (approx. first 200 chars): ${problematicSubstring}`, details: parseError.message })}\n\n`);
      return; 
    }
  } else {
     logger.warn(`[${operationId}] AI 서비스: Vertex AI 최종 응답에서 JSON 코드 블록을 찾지 못했습니다 (parseAndFinalizeAnalysis). fullResponseText 길이: ${fullResponseText.length}`);
     if (!res.writableEnded) res.write(`event: error\ndata: ${JSON.stringify({ error: "AI 응답에서 최종 분석 결과를 추출하지 못했습니다.", rawResponsePreview: fullResponseText.substring(0, 500) })}\n\n`);
     return; 
  }
  
  // 조건문 진입 전 상태 로깅
  logger.debug(`[${operationId}] AI 서비스: Pre-DB update check. finalAnalysisData is ${finalAnalysisData ? 'defined' : 'undefined/null'}. res.writableEnded is ${res.writableEnded}.`);

  if (finalAnalysisData && !res.writableEnded) {
    // DB에 generatedMarkdown 업데이트 시도
    logger.debug(`[${operationId}] AI 서비스: DB 업데이트 조건 확인용 finalAnalysisData.suggestedResumeMarkdown 타입: ${typeof finalAnalysisData.suggestedResumeMarkdown}, 길이: ${finalAnalysisData.suggestedResumeMarkdown?.length}, 내용 (앞 50자): ${finalAnalysisData.suggestedResumeMarkdown?.substring(0,50)}`);
    logger.debug(`[${operationId}] AI 서비스: DB 업데이트 조건 확인용 operationId: ${operationId}`);
    // logger.debug(`[${operationId}] AI 서비스: 전체 finalAnalysisData 객체:`, JSON.stringify(finalAnalysisData, null, 2)); // 전체 객체 로깅 (필요시 주석 해제)

    if (finalAnalysisData.suggestedResumeMarkdown && typeof finalAnalysisData.suggestedResumeMarkdown === 'string' && finalAnalysisData.suggestedResumeMarkdown.trim() !== "" && operationId) {
      logger.info(`[${operationId}] AI 서비스: DB 업데이트 시도 중... Markdown 길이: ${finalAnalysisData.suggestedResumeMarkdown.length}`);
      try {
        await db.update(resumesTable) // await 사용
          .set({ 
            generatedMarkdown: finalAnalysisData.suggestedResumeMarkdown,
            status: 'completed', // 상태도 'completed'로 업데이트
            updatedAt: new Date(),
          })
          .where(eq(resumesTable.id, operationId));
        logger.info(`[${operationId}] AI 서비스: generatedMarkdown 및 상태 DB 업데이트 완료.`);
      } catch (dbError) {
        logger.error(`[${operationId}] AI 서비스: generatedMarkdown DB 업데이트 중 오류:`, dbError);
        // DB 업데이트 실패가 전체 프로세스를 중단시켜서는 안 되므로, 오류 로깅 후 계속 진행
      }
    }

    res.write(`event: complete\ndata: ${JSON.stringify({ analysis: finalAnalysisData, operationId: operationId })}\n\n`);
    // 성공적으로 complete 이벤트 전송 후 refinementDetails 초기화 (이 로직은 parseAndFinalizeAnalysis의 다른 부분에서 이미 처리됨)
    const connection = activeConnections.get(operationId);
    if (connection && connection.refinementDetails) { // refinementDetails가 있을 때만 초기화
        connection.refinementDetails = null;
        activeConnections.set(operationId, connection);
        logger.info(`[${operationId}] AI 서비스: refinementDetails 초기화 완료 (parseAndFinalizeAnalysis).`);
    }
  }
}

async function handleAnalysisSSE(req, res, operationId) {
  logger.info(`[Service] handleAnalysisSSE 호출됨. Operation ID: ${operationId}`);
  
  try {
    const connection = initializeSSEConnection(res, operationId);
    if (!connection) {
      return; 
    }

    const { extractedText, jobPostingText } = connection.requestData;
    // getVertexAIStream 호출 시 res 전달 불필요 (오류 처리는 handleAnalysisSSE에서)
    const vertexStream = await getVertexAIStream(extractedText, jobPostingText, operationId);

    if (!vertexStream) {
      // getVertexAIStream 내부에서 AbortError로 인해 null이 반환된 경우, 이미 로그가 찍혔을 것이고,
      // 클라이언트 연결은 아직 살아있을 수 있으므로, 여기서 명시적으로 에러를 보내거나 연결을 종료할 필요는 없을 수 있음.
      // 단, AbortError가 아닌 다른 이유로 null이 반환되었다면 오류 메시지 전송 필요.
      // getVertexAIStream에서 AbortError가 아닌 오류는 logger.error로 찍히므로, 여기서는 일반적인 실패로 간주.
      logger.error(`[${operationId}] AI 서비스: Vertex AI 스트림을 가져오지 못했습니다. (handleAnalysisSSE)`);
      if (res && !res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: "AI 스트림을 시작하지 못했습니다." })}\n\n`);
      }
      // finally에서 정리하므로 여기서 return만.
      return; 
    }

    req.on("close", () => {
      logger.info(`[${operationId}] AI 서비스: 클라이언트 SSE 연결 종료 감지 (req.on close in handleAnalysisSSE).`);
      // cancelOperationById(operationId); // 프론트엔드가 refine을 위해 의도적으로 연결을 닫는 경우가 있으므로, 여기서 무조건 취소하지 않음.
                                        // 실제 작업 취소는 프론트엔드의 명시적 요청 (예: blocker, pagehide)으로 처리됨.
                                        // 만약 여기서 AbortController를 호출해야 한다면, activeConnections에서 삭제는 하지 말아야 함.
                                        // 우선은 호출 자체를 주석 처리하여 refine 흐름을 확인.
      const connection = activeConnections.get(operationId);
      if (connection && connection.abortController && !connection.abortController.signal.aborted) {
        // 연결이 단순히 끊어진 경우, 백엔드에서 진행중인 AI 작업은 중단시키는 것이 좋을 수 있음.
        // 다만, 이것이 refine을 위한 '일시적' 연결 끊김인지, 실제 사용자 이탈인지 구분하기 어려움.
        // 현재는 prepareForRefinement에서 abort를 호출하므로, 여기서는 추가 abort 호출을 생략.
        logger.info(`[${operationId}] AI 서비스: req.on('close') - 현재는 명시적 작업 중단 안 함. prepareForRefinement 또는 프론트엔드 취소 요청에 의존.`);
      }
    });

    const fullResponseText = await processAndStreamVertexResponse(vertexStream, res, operationId);

    if (fullResponseText === null) {
      logger.info(`[${operationId}] AI 서비스: 스트리밍 처리 중 문제 발생 또는 연결이 조기 종료되어 최종 분석을 진행하지 않습니다.`);
      return; 
    }

    const finalConnectionState = activeConnections.get(operationId);
    if (!finalConnectionState || !finalConnectionState.response || finalConnectionState.response.writableEnded) {
      logger.info(`[${operationId}] AI 서비스: 스트림 루프 종료 후 작업 취소 또는 연결 종료됨 (handleAnalysisSSE).`);
      return; 
    }
    
    await parseAndFinalizeAnalysis(fullResponseText, res, operationId); // await 추가

  } catch (error) { 
    logger.error(`[${operationId}] AI 서비스: handleAnalysisSSE에서 예기치 않은 오류 발생:`, error);
    if (res && !res.writableEnded) {
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ error: "서버 내부 오류가 발생했습니다." })}\n\n`);
      } catch (e) { /* 이미 응답이 종료되었을 수 있음 */ }
    }
  } finally {
    const connection = activeConnections.get(operationId);
    if (connection) {
      if (connection.response && !connection.response.writableEnded) {
        connection.response.end();
      }
      // activeConnections에서 바로 삭제하는 대신, 상태를 초기화하여 개선 요청에 대비.
      connection.response = null;
      connection.stream = null;
      connection.sseStarted = false;
      // abortController는 prepareForRefinement 또는 다음 initiate 시 새로 생성되거나,
      // 여기서 새로 만들어 둘 수도 있습니다. 
      // connection.abortController = new AbortController(); // 다음 요청을 위해 새 AbortController 준비
      // refinementDetails는 parseAndFinalizeAnalysis에서 null로 처리됨.
      activeConnections.set(operationId, connection);
      logger.info(`[${operationId}] AI 서비스: SSE 스트림 처리 완료, 연결 정보 유지 (handleAnalysisSSE finally).`);
    } else {
      logger.info(`[${operationId}] AI 서비스: SSE 스트림 처리 완료 후 activeConnections에 ID 없음 (handleAnalysisSSE finally).`);
    }
    // activeConnections.delete(operationId); // 삭제하지 않고 유지

    // 스트림 완료 후 refinementDetails 초기화 (정상 완료 시에만)
    // cancelOperationById에서도 activeConnections.delete를 하므로, 여기서 별도 처리는 불필요할 수 있으나,
    // 명시적으로 handleAnalysisSSE가 성공적으로 'complete'까지 간 경우에만 초기화하는 것이 안전.
    // 단, 이 finally는 오류 발생 시에도 호출되므로, 실제로는 parseAndFinalizeAnalysis 성공 후 또는 
    // processAndStreamVertexResponse에서 'complete' 이벤트 전송 직전에 하는 것이 더 정확할 수 있음.
    // 여기서는 우선 삭제 후 로그만 남기고, 필요시 위치 조정.
    // -> parseAndFinalizeAnalysis 성공 후 또는 processAndStreamVertexResponse에서 'complete' 이벤트 전송 직전에 하는 것이 더 정확.
    // -> fullResponseText가 null이 아니고, res.writableEnded가 false일 때, 즉 complete 이벤트 보내기 직전에 초기화.
  }
}

// 해당 동기 버전의 parseAndFinalizeAnalysis 함수 정의가 이 위치에 있었다면 삭제됩니다.
// async 버전의 parseAndFinalizeAnalysis 함수는 파일 상단에 이미 정의되어 있어야 합니다.

module.exports = {
  initiateAnalysisOperation,
  getStoredAnalysisData,
  prepareForRefinement, // 추가
  cancelOperationById,
  handleAnalysisSSE,
};
