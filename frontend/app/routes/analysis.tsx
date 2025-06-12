import type { MetaFunction } from "@remix-run/node"; 
import { Link, useBlocker } from "@remix-run/react"; 
import { useState, useEffect, useRef, useCallback } from "react"; // useCallback 추가
import ReactMarkdown from 'react-markdown'; 
import remarkGfm from 'remark-gfm'; 
import ResumeAnalysisForm from "~/components/ResumeAnalysisForm";
import AnalysisResultDisplay from "~/components/AnalysisResultDisplay";
import FeedbackForm from "~/components/FeedbackForm";
import { useAnalysisStream, type AnalysisResult, type SSEEventData } from '~/hooks/useAnalysisStream'; // 커스텀 훅 및 타입 import
import logger from "~/utils/logger";
import { sendCancelRequestToBackend, handleSubmitAnalysis, handleRefineAnalysisRequest } from '~/utils/apiUtils'; // handleRefineAnalysisRequest import 추가

export const meta: MetaFunction = () => {
  return [
    { title: "AI 이력서 분석 및 생성" },
    { name: "description", content: "AI를 사용하여 이력서를 분석하고 맞춤형으로 생성합니다." },
  ];
};

/**
 * AI 이력서 분석 페이지 컴포넌트입니다.
 * 파일 업로드, SSE를 통한 실시간 분석 결과 수신, 피드백 기반 개선 요청 기능을 제공합니다.
 */
export default function AnalysisPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  // const [dbRecordId, setDbRecordId] = useState<number | null>(null); // 현재 사용되지 않음
  const [userFeedback, setUserFeedback] = useState("");
  const [currentJobPostingUrl, setCurrentJobPostingUrl] = useState<string>("");
  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasConfirmedNavigationRef = useRef(false); 
  const currentOperationIdRef = useRef(currentOperationId);
  const isLoadingRef = useRef(isLoading);
  const isRefiningRef = useRef(isRefining);

  useEffect(() => {
    isRefiningRef.current = isRefining;
    logger.debug(`[DEBUG] isRefiningRef updated to: ${isRefining}`);
  }, [isRefining]);

  useEffect(() => {
    currentOperationIdRef.current = currentOperationId;
    logger.debug(`[DEBUG] currentOperationIdRef updated to: ${currentOperationId}`);
  }, [currentOperationId]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
    logger.debug(`[DEBUG] isLoadingRef updated to: ${isLoading}`);
  }, [isLoading]);

  // 페이지 이탈 시 작업 취소 로직
  useEffect(() => {
    const handleActualPageUnload = () => {
      if (isLoadingRef.current && currentOperationIdRef.current && !hasConfirmedNavigationRef.current) {
        logger.debug(`[DEBUG] 'pagehide' event: Sending cancel for OpId ${currentOperationIdRef.current}.`);
        sendCancelRequestToBackend(currentOperationIdRef.current);
      }
    };
    window.addEventListener('pagehide', handleActualPageUnload);
    return () => {
      logger.debug(`[DEBUG] Cleanup for 'pagehide' useEffect. Current OpId at cleanup: ${currentOperationIdRef.current}`);
      window.removeEventListener('pagehide', handleActualPageUnload);
    };
  }, [sendCancelRequestToBackend]);

  /**
   * Remix의 `useBlocker`를 사용하여, 분석 작업(isLoadingRef.current가 true)이 진행 중이고
   * 사용자가 페이지를 이탈하려고 할 때 확인 대화 상자를 표시합니다.
   * 사용자가 이탈을 확인하면, 현재 진행 중인 EventSource 연결을 닫고 백엔드에 작업 취소를 요청한 후 페이지 이동을 허용합니다.
   * 사용자가 이탈을 취소하면, blocker 상태를 리셋합니다.
   * `hasConfirmedNavigationRef`를 사용하여 사용자가 이미 이탈을 확인한 경우에는 blocker가 다시 활성화되지 않도록 합니다.
   */
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isLoadingRef.current && 
      currentOperationIdRef.current != null &&
      !hasConfirmedNavigationRef.current && 
      currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker && blocker.state === "blocked") {
      logger.debug(`[DEBUG] Blocker activated. OpId: ${currentOperationIdRef.current}, Blocker state: ${blocker.state}`);
      if (confirm("분석이 진행 중입니다. 정말 페이지를 벗어나시겠습니까?")) {
        logger.debug(`[DEBUG] Blocker: User confirmed navigation for OpId: ${currentOperationIdRef.current}`);
        hasConfirmedNavigationRef.current = true; 
        if (eventSourceRef.current) {
            logger.debug(`[DEBUG] Blocker: Closing EventSource for OpId: ${currentOperationIdRef.current}`);
            eventSourceRef.current.close();
            eventSourceRef.current = null; 
        }
        if (currentOperationIdRef.current) { 
            sendCancelRequestToBackend(currentOperationIdRef.current);
        }
        blocker.proceed();
      } else {
        logger.debug(`[DEBUG] Blocker: User cancelled navigation for OpId: ${currentOperationIdRef.current}`);
        blocker.reset();
      }
    }
  }, [blocker, sendCancelRequestToBackend]); 

  /**
   * SSE 연결이 성공적으로 열렸을 때 호출되는 콜백 함수입니다.
   * 현재 작업 ID와 함께 연결 성공 로그를 기록합니다.
   */
  const handleSSEOpen = useCallback(() => {
    logger.info(`[AnalysisPage] SSE connection opened for opId: ${currentOperationIdRef.current}.`);
  }, []);

  /**
   * SSE를 통해 메시지(분석 결과의 청크)가 수신될 때마다 호출되는 콜백 함수입니다.
   * 수신된 청크를 기존 `analysisResult.suggestedResumeMarkdown`에 추가하여 상태를 업데이트합니다.
   * @param eventData - {@link SSEEventData} 타입의 객체. `chunk` 필드에 스트리밍된 텍스트 조각이 포함됩니다.
   */
  const handleSSEMessage = useCallback((eventData: SSEEventData) => {
    if (eventData.chunk) {
      setAnalysisResult((prev) => {
        const newMarkdown = (prev?.suggestedResumeMarkdown || "") + eventData.chunk;
        if (prev === null) { // 스트리밍 시작 시점
          return { suggestedResumeMarkdown: newMarkdown };
        }
        return { ...prev, suggestedResumeMarkdown: newMarkdown };
      });
    }
  }, []);

  const handleSSEComplete = useCallback((eventData: SSEEventData) => {
    logger.info(`[AnalysisPage] SSE event 'complete' for opId ${currentOperationIdRef.current}. Data:`, eventData);
    if (eventData.analysis) {
      setAnalysisResult(eventData.analysis);
    } else if (eventData.error) {
      setError(eventData.error);
    }
    setIsLoading(false);
    setIsRefining(false); 
    // EventSource 닫기는 useAnalysisStream 훅 내부에서 처리
    logger.info(`[AnalysisPage] SSE 'complete'. CurrentOperationId RETAINED for potential refinement.`);
  }, []);

  const handleSSEError = useCallback((error: any, operationIdOnError: string | null) => {
    logger.error(`[AnalysisPage] EventSource encountered an error for opId ${operationIdOnError}:`, error);
    setError(error.message || "SSE connection error.");
    setIsLoading(false);
    setIsRefining(false); 
    setCurrentOperationId(null); // 오류 발생 시 operationId 초기화
    // EventSource 닫기는 useAnalysisStream 훅 내부에서 처리
    logger.info(`[AnalysisPage] SSE 'error'. OpId ${operationIdOnError} closed.`);
  }, []);

  // useAnalysisStream 훅 사용
  /**
   * `useAnalysisStream` 커스텀 훅을 사용하여 SSE 연결 및 이벤트 처리를 관리합니다.
   * - `operationId`, `isLoading`, `isRefining` 상태를 전달하여 훅의 동작을 제어합니다.
   * - SSE 이벤트 발생 시 호출될 콜백 함수들(`handleSSEOpen`, `handleSSEMessage`, `handleSSEComplete`, `handleSSEError`)을 전달합니다.
   * - `eventSourceRef`를 전달하여 훅 내부에서 EventSource 인스턴스를 관리할 수 있도록 합니다.
   */
  useAnalysisStream({
    operationId: currentOperationId,
    isLoading,
    isRefining,
    onOpen: handleSSEOpen,
    onMessage: handleSSEMessage,
    onComplete: handleSSEComplete,
    onError: handleSSEError,
    eventSourceRef,
  });

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    handleSubmitAnalysis({
      event,
      eventSourceRef,
      currentOperationIdRef,
      isLoadingRef,
      sendCancelRequestToBackend,
      setCurrentJobPostingUrl,
      setAnalysisResult,
      setError,
      setFileName,
      setUserFeedback,
      // setHasConfirmedNavigation: (confirmed: boolean) => { hasConfirmedNavigationRef.current = confirmed; }, // 이 부분은 handleSubmitAnalysis 내부에서 직접 관리하지 않으므로, AnalysisPage에서 관리
      setIsLoading,
      setIsRefining,
      setCurrentOperationId,
    });
    // handleSubmitAnalysis 내부에서 hasConfirmedNavigationRef.current = false; 와 유사한 로직이 필요하면 추가
    hasConfirmedNavigationRef.current = false;
  };

  /**
   * 사용자가 피드백 텍스트 영역의 내용을 변경할 때 호출되는 콜백 함수입니다.
   * 입력된 값으로 `userFeedback` 상태를 업데이트합니다.
   * @param event - {@link React.ChangeEvent<HTMLTextAreaElement>} 타입의 이벤트 객체.
   */
  const handleFeedbackChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserFeedback(event.target.value);
  };

  /**
   * "개선 요청" 버튼 클릭 시 호출되는 핸들러 함수입니다.
   * `handleRefineAnalysisRequest` 유틸리티 함수를 호출하여 실제 개선 요청 로직을 수행합니다.
   * 이 함수는 `analysisResult`와 같은 현재 컴포넌트의 상태를 `handleRefineAnalysisRequest`에 전달합니다.
   * 또한, 개선 요청 후에는 페이지 이탈 방지 로직을 위해 `hasConfirmedNavigationRef`를 `false`로 설정합니다.
   */
  const callHandleRefineRequest = () => {
    handleRefineAnalysisRequest({
      currentOperationIdRef,
      userFeedback,
      analysisResult,
      eventSourceRef,
      setError,
      setAnalysisResult,
      setIsRefining,
      setIsLoading,
      // setHasConfirmedNavigation: (confirmed: boolean) => { hasConfirmedNavigationRef.current = confirmed; }, // AnalysisPage에서 관리
    });
    hasConfirmedNavigationRef.current = false;
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center">
      <div className="w-full bg-white dark:bg-gray-800 shadow-sm">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">AI 이력서 분석</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                이력서와 채용 공고를 업로드하고 AI의 맞춤 분석을 받아보세요.
              </p>
            </div>
            <Link to="/" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
              &larr; 홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full max-w-2xl p-4 mt-8">
        <ResumeAnalysisForm isLoading={isLoading} onSubmit={handleFormSubmit} />

        {isLoading && !analysisResult && ( 
          <div className="mt-12 text-center flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
            <p className="text-lg text-gray-700 dark:text-gray-300">AI가 이력서를 분석하고 있습니다. 잠시만 기다려주세요...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">(이 작업은 최대 1-2분 소요될 수 있습니다.)</p>
          </div>
        )}

        {error && (
          <div className="mt-8 p-6 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 rounded-md">
            <h2 className="text-xl font-semibold text-red-700 dark:text-red-200 mb-2">오류 발생</h2>
            <p className="text-red-600 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* analysisResult가 존재하면 AnalysisResultDisplay와 FeedbackForm을 렌더링 */}
        {analysisResult && (
          <>
            <AnalysisResultDisplay analysisResult={analysisResult} fileName={fileName} />
            {/* FeedbackForm은 로딩이 아닐 때만 표시 */}
            {!isLoading && (
              <FeedbackForm
                isLoading={isLoading}
                userFeedback={userFeedback}
                onFeedbackChange={handleFeedbackChange}
                onRefineRequest={callHandleRefineRequest}
              />
            )}
          </>
        )}
        {/* "분석 결과 (실시간)" 섹션은 사용자 요청에 따라 제거되었습니다. */}
      </div>
    </div>
  );
}
