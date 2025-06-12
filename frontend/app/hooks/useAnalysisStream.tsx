import { useEffect, useRef } from 'react';
import logger from '~/utils/logger';

/**
 * AI 분석 결과의 구조를 정의합니다.
 */
export interface AnalysisResult {
  /** AI가 생성한 이력서 요약 */
  summary?: string;
  /** AI가 추출하거나 제안한 주요 기술 스택 */
  skills?: string[];
  /** AI가 추출하거나 제안한 강점 */
  strengths?: string[];
  /** AI가 제안한 이력서 개선점 */
  improvementSuggestions?: string[];
  /** AI가 생성한 추천 이력서 마크다운 전문 */
  suggestedResumeMarkdown?: string;
}

/**
 * Server-Sent Events (SSE)를 통해 수신되는 데이터의 구조를 정의합니다.
 */
export interface SSEEventData {
  /** 스트리밍되는 텍스트 조각 */
  chunk?: string;
  /** 분석이 완료되었을 때 전체 분석 결과 객체 */
  analysis?: AnalysisResult;
  /** 오류 발생 시 오류 메시지 */
  error?: string;
  /** 일반 정보 메시지 (사용되지 않을 수 있음) */
  message?: string;
  /** 현재 작업의 고유 식별자 */
  operationId?: string;
}

/**
 * useAnalysisStream 훅의 props 타입을 정의합니다.
 */
export interface UseAnalysisStreamProps {
  /** 분석 작업을 식별하는 고유 ID. null일 경우 SSE 연결을 시도하지 않습니다. */
  operationId: string | null;
  /** 현재 로딩 상태 여부. true이고 operationId가 유효하면 SSE 연결을 시작합니다. */
  isLoading: boolean;
  /** 현재 개선 작업 진행 여부. (useEffect 의존성 배열에 포함되어 로직에 영향을 줄 수 있음) */
  isRefining: boolean;
  /** SSE 연결이 성공적으로 열렸을 때 호출되는 콜백 함수 (선택 사항) */
  onOpen?: () => void;
  /** SSE 메시지(chunk) 수신 시 호출되는 콜백 함수 */
  onMessage: (data: SSEEventData) => void;
  /** SSE 'complete' 이벤트 수신 시 호출되는 콜백 함수 */
  onComplete: (data: SSEEventData) => void;
  /** SSE 오류 발생 또는 파싱 오류 시 호출되는 콜백 함수 */
  onError: (error: any, operationId: string | null) => void;
  /** EventSource 인스턴스를 참조하기 위한 ref 객체 */
  eventSourceRef: React.MutableRefObject<EventSource | null>;
}

/**
 * Server-Sent Events (SSE)를 통해 AI 분석 결과 스트리밍을 관리하는 커스텀 훅입니다.
 * 
 * @param props - 훅의 동작을 제어하는 설정 객체.
 * @param props.operationId - 분석 작업을 식별하는 고유 ID.
 * @param props.isLoading - 로딩 상태. true이고 operationId가 있으면 SSE 연결을 시작합니다.
 * @param props.isRefining - 개선 작업 진행 여부. (useEffect 의존성으로 사용)
 * @param props.onOpen - SSE 연결 성공 시 호출될 콜백.
 * @param props.onMessage - SSE 메시지 수신 시 호출될 콜백.
 * @param props.onComplete - SSE 'complete' 이벤트 수신 시 호출될 콜백.
 * @param props.onError - SSE 오류 발생 시 호출될 콜백.
 * @param props.eventSourceRef - EventSource 인스턴스를 저장할 ref.
 */
export function useAnalysisStream({
  operationId,
  isLoading,
  isRefining,
  onOpen,
  onMessage,
  onComplete,
  onError,
  eventSourceRef,
}: UseAnalysisStreamProps) {

  useEffect(() => {
    let es: EventSource | null = null;
    const operationIdForEffect = operationId;

    if (operationIdForEffect && isLoading) {
      logger.debug(`[useAnalysisStream DEBUG] Creating EventSource for OpId: ${operationIdForEffect}`);
      const sseUrl = `http://localhost:3001/api/stream-analysis?operationId=${operationIdForEffect}`;
      es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        logger.info(`[useAnalysisStream Frontend] SSE connection opened for opId: ${operationIdForEffect}. EventSource readyState: ${es?.readyState}`);
        if (onOpen) {
          onOpen();
        }
      };

      es.onmessage = (event) => {
        try {
          const eventData: SSEEventData = JSON.parse(event.data);
          onMessage(eventData);
        } catch (e) {
          logger.error("[useAnalysisStream Frontend] Error parsing SSE message data:", e, "Raw data:", event.data);
          onError(new Error("Error parsing SSE message data"), operationIdForEffect);
        }
      };

      es.addEventListener('complete', (event) => {
        const rawData = (event as MessageEvent).data;
        logger.info(`[useAnalysisStream Frontend] SSE event 'complete' for opId ${operationIdForEffect}. Data:`, rawData);
        try {
          const eventData: SSEEventData = JSON.parse(rawData);
          onComplete(eventData);
        } catch (e) {
          logger.error("[useAnalysisStream Frontend] Error parsing 'complete' event data:", e, "Raw data:", rawData);
          onError(new Error("Error parsing 'complete' event data"), operationIdForEffect);
        }
        es?.close();
        eventSourceRef.current = null;
      });

      es.onerror = (errorEvent) => {
        logger.error(`[useAnalysisStream Frontend] EventSource encountered an error for opId ${operationIdForEffect}:`, errorEvent);
        let message = "SSE connection error.";
        if (errorEvent.target && (errorEvent.target as EventSource).readyState === EventSource.CLOSED) {
            message = `SSE connection was closed. ReadyState: ${(errorEvent.target as EventSource).readyState}`;
        } else if (errorEvent.target && (errorEvent.target as EventSource).readyState === EventSource.CONNECTING) {
            message = `SSE connection failed to open. ReadyState: ${(errorEvent.target as EventSource).readyState}`;
        }
        onError(new Error(message), operationIdForEffect);
        es?.close();
        eventSourceRef.current = null;
      };
    }

    return () => {
      const opIdAtCleanup = operationIdForEffect;
      logger.debug(`[useAnalysisStream DEBUG] useEffect CLEANUP for OpId: ${opIdAtCleanup}. isLoading: ${isLoading}`);
      if (es) {
        logger.debug(`[useAnalysisStream DEBUG] Closing 'es' instance for ${opIdAtCleanup}`);
        es.close();
      }
      if (eventSourceRef.current && eventSourceRef.current === es) {
         eventSourceRef.current = null;
      }
    };
  }, [operationId, isLoading, isRefining, onOpen, onMessage, onComplete, onError, eventSourceRef]); // eventSourceRef도 의존성에 추가 (prop으로 받으므로)
}
