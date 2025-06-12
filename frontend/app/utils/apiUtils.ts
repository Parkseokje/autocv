import logger from '~/utils/logger';

/**
 * 백엔드 서버에 특정 작업(operation)의 취소를 요청합니다.
 * 이 함수는 fetch API를 사용하여 비동기적으로 요청을 보내며, `keepalive: true` 옵션을 사용하여
 * 페이지가 언로드되는 중에도 요청이 완료될 가능성을 높입니다.
 * 
 * @param operationId - 취소하고자 하는 작업의 고유 식별자입니다. null일 경우 아무 작업도 수행하지 않습니다.
 * @returns Promise<void> - 요청 성공 여부와 관계없이 void를 반환합니다. 오류는 내부적으로 로깅됩니다.
 */
export const sendCancelRequestToBackend = async (operationId: string | null): Promise<void> => {
  if (!operationId) {
    logger.debug("[apiUtils] sendCancelRequestToBackend: No operationId to cancel.");
    return;
  }
  logger.debug(`[apiUtils] Attempting to send cancel request for operationId: ${operationId}`);
  try {
    const response = await fetch("http://localhost:3001/api/cancel-operation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operationId }),
      keepalive: true,
    });
    logger.debug(`[apiUtils] Sent cancel request for operationId: ${operationId}. Status: ${response.status}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`[apiUtils] Cancel request failed for ${operationId}. Status: ${response.status}`, errorData);
    }
  } catch (e) {
    logger.error(`[apiUtils] Error sending cancel request for operationId: ${operationId}`, e);
  }
};

interface HandleSubmitParams {
  event: React.FormEvent<HTMLFormElement>;
  eventSourceRef: React.MutableRefObject<EventSource | null>;
  currentOperationIdRef: React.RefObject<string | null>;
  isLoadingRef: React.RefObject<boolean>;
  sendCancelRequestToBackend: (operationId: string | null) => Promise<void>;
  setCurrentJobPostingUrl: (url: string) => void;
  setAnalysisResult: (result: any) => void; // AnalysisResult | null 타입이지만, 간결하게 any 사용
  setError: (error: string | null) => void;
  setFileName: (name: string | null) => void;
  setUserFeedback: (feedback: string) => void;
  // setHasConfirmedNavigation: (confirmed: boolean) => void; // 이 부분은 AnalysisPage 내부 상태이므로 직접 전달보다는 다른 방식 고려 필요
  setIsLoading: (loading: boolean) => void;
  setIsRefining: (refining: boolean) => void;
  setCurrentOperationId: (id: string | null) => void;
}

/**
 * 사용자가 제출한 이력서 파일과 채용 공고 URL을 기반으로 AI 분석을 시작합니다.
 * 이 함수는 다음 단계를 수행합니다:
 * 1. 기존에 진행 중이던 EventSource 연결 및 백엔드 작업을 정리합니다.
 * 2. 폼 데이터를 구성하고, 파일 이름을 UTF-8로 인코딩하여 포함합니다.
 * 3. 관련 상태들을 초기화합니다 (로딩 상태, 분석 결과, 오류 메시지 등).
 * 4. 백엔드의 `/api/initiate-analysis` 엔드포인트에 분석 시작 요청을 보냅니다.
 * 5. 요청 성공 시, 반환된 operationId와 파일 이름을 사용하여 상태를 업데이트하고 SSE 스트리밍을 준비합니다.
 * 6. 요청 실패 또는 오류 발생 시, 사용자에게 오류 메시지를 표시합니다.
 *
 * @param params - {@link HandleSubmitParams} 타입의 객체. 분석 시작에 필요한 모든 상태와 콜백 함수를 포함합니다.
 * @returns Promise<void> - 작업 완료 후 void를 반환합니다.
 */
export const handleSubmitAnalysis = async ({
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
  // setHasConfirmedNavigation, // 직접 상태 변경 대신, 로직 내에서 처리하거나 반환값으로 처리
  setIsLoading,
  setIsRefining,
  setCurrentOperationId,
}: HandleSubmitParams): Promise<void> => {
  event.preventDefault();

  if (eventSourceRef.current) {
    logger.debug(`[apiUtils] handleSubmit: Closing existing EventSource for previous OpId ${currentOperationIdRef.current} before new submission.`);
    eventSourceRef.current.close();
    eventSourceRef.current = null;
  }
  if (currentOperationIdRef.current && isLoadingRef.current) {
    logger.debug(`[apiUtils] handleSubmit: Sending cancel for previous active OpId ${currentOperationIdRef.current} before new submission.`);
    sendCancelRequestToBackend(currentOperationIdRef.current);
  }

  const formElement = event.currentTarget;
  const formData = new FormData(formElement);
  const fileInput = formElement.querySelector('input[type="file"]') as HTMLInputElement;

  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    formData.append('encodedFileName', encodeURIComponent(file.name));
    logger.debug(`[apiUtils] handleSubmit: Appended encodedFileName: ${encodeURIComponent(file.name)}`);
  }

  const displayUrl = formData.get("jobPostingUrl") as string;

  setCurrentJobPostingUrl(displayUrl || "");
  setAnalysisResult(null);
  setError(null);
  setFileName(null);
  setUserFeedback("");
  // setHasConfirmedNavigation(false); // 이 부분은 AnalysisPage에서 직접 관리

  setIsLoading(true);
  setIsRefining(false); // 새 분석은 개선 작업이 아님
  setCurrentOperationId(null); // 새 분석 시작 전 초기화

  try {
    const initResponse = await fetch("http://localhost:3001/api/initiate-analysis", {
      method: "POST",
      body: formData,
    });

    // InitialResponseData 타입 정의 필요 (analysis.tsx에서 가져오거나 여기서 재정의)
    interface InitialResponseData {
      success?: boolean;
      operationId?: string;
      fileName?: string;
      error?: string;
    }
    const initData: InitialResponseData = await initResponse.json();

    if (!initResponse.ok || !initData.success || !initData.operationId) {
      logger.error("[apiUtils] Initiate analysis failed:", initData);
      setError(initData.error || "Failed to initiate analysis.");
      setIsLoading(false);
      setCurrentOperationId(null);
      return;
    }

    logger.debug(`[apiUtils] handleSubmit: initData.operationId received: ${initData.operationId}.`);
    setFileName(initData.fileName || null);
    setCurrentOperationId(initData.operationId); // 여기서 새 operationId 설정
    logger.info(`[apiUtils] Analysis initiated. New Operation ID: ${initData.operationId}. isLoading is now true.`);

  } catch (err: any) {
    logger.error('[apiUtils] Error in handleSubmit (initiate-analysis call):', err);
    setError(typeof err === 'string' ? err : err.error || err.message || "분석 시작 중 오류가 발생했습니다.");
    setIsLoading(false);
    setCurrentOperationId(null);
  }
};

interface HandleRefineParams {
  currentOperationIdRef: React.RefObject<string | null>;
  userFeedback: string;
  analysisResult: AnalysisResult | null; // AnalysisResult 타입 import 필요
  eventSourceRef: React.MutableRefObject<EventSource | null>;
  setError: (error: string | null) => void;
  setAnalysisResult: (result: any) => void; // AnalysisResult | null 타입이지만, 간결하게 any 사용
  setIsRefining: (refining: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  // setHasConfirmedNavigation: (confirmed: boolean) => void; // 이 부분은 AnalysisPage에서 직접 관리
}

/**
 * AnalysisResult 인터페이스는 AI 분석 결과의 구조를 정의합니다.
 * 이 타입은 `useAnalysisStream` 훅에서도 사용되므로, 해당 위치에서 import 하거나 공유된 타입 정의 파일을 사용하는 것이 좋습니다.
 * 여기서는 `apiUtils.ts` 내에서 임시로 정의합니다.
 */
interface AnalysisResult {
  /** AI가 생성한 추천 이력서의 전체 마크다운 내용입니다. */
  suggestedResumeMarkdown?: string;
  /** AI가 생성한 이력서 요약입니다. (선택적 필드) */
  summary?: string;
  /** AI가 추출하거나 제안한 주요 기술 스택입니다. (선택적 필드) */
  skills?: string[];
  /** AI가 추출하거나 제안한 강점입니다. (선택적 필드) */
  strengths?: string[];
  /** AI가 제안한 이력서 개선점입니다. (선택적 필드) */
  improvementSuggestions?: string[];
}


/**
 * 기존 분석 결과에 대한 사용자 피드백을 바탕으로 AI에게 이력서 개선을 요청합니다.
 * 이 함수는 다음 단계를 수행합니다:
 * 1. 현재 진행 중인 분석 작업이 있는지, 사용자 피드백이 유효한지 확인합니다.
 * 2. 기존 EventSource 연결을 정리합니다.
 * 3. 관련 상태들을 초기화하고, 개선 작업(refining) 및 로딩 상태를 활성화합니다.
 * 4. 백엔드의 `/api/refine-analysis` 엔드포인트에 개선 요청을 보냅니다. 이 요청에는
 *    현재 작업 ID, 개선 대상 섹션("suggestedResumeMarkdown"), 사용자 입력, 그리고 이전 분석 결과의 마크다운이 포함됩니다.
 * 5. 요청 성공 시, 백엔드는 새로운 SSE 스트리밍을 준비합니다. (이 함수는 요청만 보내고 스트리밍 자체는 `useAnalysisStream` 훅이 담당)
 * 6. 요청 실패 또는 오류 발생 시, 사용자에게 오류 메시지를 표시합니다.
 *
 * @param params - {@link HandleRefineParams} 타입의 객체. 개선 요청에 필요한 모든 상태와 콜백 함수를 포함합니다.
 * @returns Promise<void> - 작업 완료 후 void를 반환합니다.
 */
export const handleRefineAnalysisRequest = async ({
  currentOperationIdRef,
  userFeedback,
  analysisResult,
  eventSourceRef,
  setError,
  setAnalysisResult,
  setIsRefining,
  setIsLoading,
  // setHasConfirmedNavigation,
}: HandleRefineParams): Promise<void> => {
  logger.debug("[apiUtils] handleRefineRequest called");
  if (!currentOperationIdRef.current) {
    logger.debug("[apiUtils] handleRefineRequest: No currentOperationIdRef.current, returning.");
    setError("현재 진행 중인 분석 작업이 없어 개선 요청을 보낼 수 없습니다. 먼저 분석을 시작해주세요.");
    return;
  }
  if (!userFeedback.trim()) {
    logger.debug("[apiUtils] handleRefineRequest: userFeedback is empty, returning.");
    setError("피드백 또는 추가 요청사항을 입력해주세요.");
    return;
  }

  logger.debug(`[apiUtils] handleRefineRequest: Initiating refinement for OpId ${currentOperationIdRef.current} with feedback: ${userFeedback}`);

  if (eventSourceRef.current) {
    logger.debug(`[apiUtils] handleRefineRequest: Closing existing EventSource before sending refine request for OpId ${currentOperationIdRef.current}`);
    eventSourceRef.current.close();
    eventSourceRef.current = null;
  }

  setError(null);
  setAnalysisResult(null);
  setIsRefining(true);
  setIsLoading(true);
  // setHasConfirmedNavigation(false); // AnalysisPage에서 관리

  try {
    const refinePrepareResponse = await fetch("http://localhost:3001/api/refine-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operationId: currentOperationIdRef.current,
        section: "suggestedResumeMarkdown",
        userInput: userFeedback,
        previousMarkdown: analysisResult?.suggestedResumeMarkdown || "",
      }),
    });

    const prepareData = await refinePrepareResponse.json();

    if (!refinePrepareResponse.ok || !prepareData.success) {
      logger.error("[apiUtils] Refine prepare request failed:", prepareData);
      setError(prepareData.message || "개선 요청 준비에 실패했습니다.");
      setIsLoading(false);
      setIsRefining(false);
      return;
    }

    logger.debug(`[apiUtils] handleRefineRequest: Refine prepare request successful for OpId ${currentOperationIdRef.current}. Message: ${prepareData.message}`);
  } catch (err: any) {
    logger.error('[apiUtils] Error in handleRefineRequest (refine-analysis call):', err);
    setError(err.message || "개선 요청 중 오류가 발생했습니다.");
    setIsLoading(false);
    setIsRefining(false);
  }
};
