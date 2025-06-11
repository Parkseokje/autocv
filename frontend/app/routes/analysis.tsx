import type { MetaFunction } from "@remix-run/node"; 
import { Link, useBlocker } from "@remix-run/react"; 
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from 'react-markdown'; // ReactMarkdown import
import remarkGfm from 'remark-gfm'; // remarkGfm import
import ResumeAnalysisForm from "~/components/ResumeAnalysisForm";
import AnalysisResultDisplay from "~/components/AnalysisResultDisplay";
import FeedbackForm from "~/components/FeedbackForm";

export const meta: MetaFunction = () => {
  return [
    { title: "AI 이력서 분석 및 생성" },
    { name: "description", content: "AI를 사용하여 이력서를 분석하고 맞춤형으로 생성합니다." },
  ];
};

interface AnalysisResult {
  summary?: string;
  skills?: string[];
  strengths?: string[];
  improvementSuggestions?: string[];
  suggestedResumeMarkdown?: string;
}

interface InitialResponseData {
  success?: boolean;
  operationId?: string;
  fileName?: string;
  error?: string;
}

interface SSEEventData {
  chunk?: string; 
  analysis?: AnalysisResult; 
  error?: string; 
  message?: string; 
  operationId?: string; 
}


export default function AnalysisPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false); // isRefining 상태 추가
  const [streamedContent, setStreamedContent] = useState<string>(""); 
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [userFeedback, setUserFeedback] = useState("");
  const [dbRecordId, setDbRecordId] = useState<number | null>(null); 
  const [currentJobPostingUrl, setCurrentJobPostingUrl] = useState<string>("");
  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasConfirmedNavigationRef = useRef(false); 
  const currentOperationIdRef = useRef(currentOperationId);
  const isLoadingRef = useRef(isLoading); // isLoading 상태를 위한 ref
  const isRefiningRef = useRef(isRefining); // isRefining 상태를 위한 ref

  useEffect(() => {
    isRefiningRef.current = isRefining;
    console.log(`[DEBUG] isRefiningRef updated to: ${isRefining}`);
  }, [isRefining]);

  useEffect(() => {
    currentOperationIdRef.current = currentOperationId;
    console.log(`[DEBUG] currentOperationIdRef updated to: ${currentOperationId}`);
  }, [currentOperationId]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
    console.log(`[DEBUG] isLoadingRef updated to: ${isLoading}`);
  }, [isLoading]);

  const sendCancelRequestToBackend = async (operationId: string | null) => {
    if (!operationId) {
      console.log("[DEBUG] sendCancelRequestToBackend: No operationId to cancel (it's null or undefined).");
      return;
    }
    // 이 함수 호출 시점에는 이미 취소해야 하는 상황으로 판단된 후이므로, 추가적인 isLoading 등의 조건은 생략 가능.
    // 단, operationId가 유효한지 한번 더 확인.
    if (operationId !== currentOperationIdRef.current && currentOperationIdRef.current !== null) {
        // console.log(`[DEBUG] sendCancelRequestToBackend: OpId ${operationId} does not match currentOpIdRef ${currentOperationIdRef.current}. Not sending.`);
        // return; // 이 조건은 상황에 따라 너무 엄격할 수 있음. 일단 주석 처리.
    }


    console.log(`[DEBUG] Attempting to send cancel request for operationId: ${operationId}`);
    try {
      const response = await fetch("http://localhost:3001/api/cancel-operation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId }),
        keepalive: true, 
      });
      console.log(`[DEBUG] Sent cancel request for operationId: ${operationId}. Status: ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[DEBUG] Cancel request failed for ${operationId}. Status: ${response.status}`, errorData);
      }
    } catch (e) {
      console.error(`[DEBUG] Error sending cancel request for operationId: ${operationId}`, e);
    }
  };
  
  useEffect(() => {
    const handleActualPageUnload = () => {
      if (isLoadingRef.current && currentOperationIdRef.current && !hasConfirmedNavigationRef.current) {
        console.log(`[DEBUG] 'pagehide' event: Sending cancel for OpId ${currentOperationIdRef.current}. isLoadingRef: ${isLoadingRef.current}, confirmedNav: ${hasConfirmedNavigationRef.current}`);
        sendCancelRequestToBackend(currentOperationIdRef.current);
      }
    };
    window.addEventListener('pagehide', handleActualPageUnload);
    return () => {
      console.log(`[DEBUG] Cleanup for 'pagehide' useEffect. Current OpId at cleanup: ${currentOperationIdRef.current}`);
      window.removeEventListener('pagehide', handleActualPageUnload);
    };
  }, []); // 의존성 배열을 비워 컴포넌트 마운트/언마운트 시에만 등록/해제, 내부에서는 ref 사용

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isLoadingRef.current && 
      currentOperationIdRef.current != null &&
      !hasConfirmedNavigationRef.current && 
      currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker && blocker.state === "blocked") {
      console.log(`[DEBUG] Blocker activated. OpId: ${currentOperationIdRef.current}, Blocker state: ${blocker.state}`);
      if (confirm("분석이 진행 중입니다. 정말 페이지를 벗어나시겠습니까?")) {
        console.log(`[DEBUG] Blocker: User confirmed navigation for OpId: ${currentOperationIdRef.current}`);
        hasConfirmedNavigationRef.current = true; 
        if (eventSourceRef.current) {
            console.log(`[DEBUG] Blocker: Closing EventSource for OpId: ${currentOperationIdRef.current}`);
            eventSourceRef.current.close();
            eventSourceRef.current = null; 
        }
        if (currentOperationIdRef.current) { 
            sendCancelRequestToBackend(currentOperationIdRef.current);
        }
        blocker.proceed();
      } else {
        console.log(`[DEBUG] Blocker: User cancelled navigation for OpId: ${currentOperationIdRef.current}`);
        blocker.reset();
      }
    }
  }, [blocker]); 

  useEffect(() => {
    let es: EventSource | null = null;
    const operationIdForEffect = currentOperationId; 

    if (operationIdForEffect && isLoading) {
      console.log(`[DEBUG] EventSource useEffect: Creating EventSource for OpId: ${operationIdForEffect}`);
      const sseUrl = `http://localhost:3001/api/stream-analysis?operationId=${operationIdForEffect}`;
      es = new EventSource(sseUrl);
      eventSourceRef.current = es;
      console.log(`[DEBUG] EventSource useEffect: EventSource object created and ref SET for OpId: ${operationIdForEffect}`);

      es.onopen = () => {
        console.log(`[Frontend] SSE connection opened for operationId: ${operationIdForEffect}. EventSource readyState: ${es?.readyState}`);
      };

      es.onmessage = (event) => {
        try {
          const eventData: SSEEventData = JSON.parse(event.data);
          if (eventData.chunk) {
            // suggestedResumeMarkdown 필드를 직접 점진적으로 업데이트
            setAnalysisResult((prev) => {
              const newMarkdown = (prev?.suggestedResumeMarkdown || "") + eventData.chunk;
              // 나머지 필드는 유지하거나, 청크 수신 시점에는 suggestedResumeMarkdown만 업데이트하고
              // complete 이벤트에서 전체를 받는다면 그때 다른 필드를 채울 수도 있음.
              // 현재는 suggestedResumeMarkdown만 업데이트하고, 다른 필드는 complete에서 채워진다고 가정.
              // 또는, prev가 null일 경우를 대비해 기본 객체 구조를 만들어 줄 수도 있음.
              if (prev === null && isLoading && !isRefining) { // 초기 분석 스트리밍 시
                return { suggestedResumeMarkdown: newMarkdown };
              }
              if (prev === null && isRefining) { // 개선 요청 스트리밍 시
                 return { suggestedResumeMarkdown: newMarkdown };
              }
              return {
                ...prev,
                suggestedResumeMarkdown: newMarkdown,
              };
            });
          }
        } catch (e) {
          console.error("[Frontend] Error parsing SSE message data:", e, "Raw data:", event.data);
        }
      };
      
      es.addEventListener('complete', (event) => {
        const rawData = (event as MessageEvent).data;
        console.log(`[Frontend] SSE event 'complete' for opId ${operationIdForEffect}. Data:`, rawData);
        try {
          const eventData: SSEEventData = JSON.parse(rawData);
          if (eventData.analysis) {
            setAnalysisResult(eventData.analysis);
            setStreamedContent(""); 
          } else if (eventData.error) {
            setError(eventData.error);
          }
        } catch (e) {
          console.error("[Frontend] Error parsing 'complete' event data:", e, "Raw data:", rawData);
          setError("분석 완료 데이터 처리 중 오류가 발생했습니다.");
        }
        setIsLoading(false);
        setIsRefining(false); // 개선 작업 완료
        // setCurrentOperationId(null); // 개선 요청을 위해 operationId를 유지하도록 이 라인 주석 처리 또는 삭제
        es?.close();
        eventSourceRef.current = null;
        console.log(`[DEBUG] EventSource closed on 'complete' for opId ${operationIdForEffect}. CurrentOperationId is RETAINED for potential refinement.`);
      });

      es.onerror = (errorEvent) => {
        console.error(`[Frontend] EventSource encountered an error for opId ${operationIdForEffect}:`, errorEvent);
        let message = "SSE connection error.";
        if (errorEvent.target && (errorEvent.target as EventSource).readyState === EventSource.CLOSED) {
            message = `SSE connection was closed. ReadyState: ${(errorEvent.target as EventSource).readyState}`;
        } else if (errorEvent.target && (errorEvent.target as EventSource).readyState === EventSource.CONNECTING) {
            message = `SSE connection failed to open. ReadyState: ${(errorEvent.target as EventSource).readyState}`;
        }
        setError(message);
        setIsLoading(false);
        setIsRefining(false); // 개선 작업 오류 시에도 false
        setCurrentOperationId(null); 
        es?.close(); 
        eventSourceRef.current = null;
        console.log(`[DEBUG] EventSource closed on 'error' for opId ${operationIdForEffect}`);
      };
    }

    return () => {
      const opIdAtCleanup = operationIdForEffect; // 클로저에 캡처된 값 사용
      console.log(`[DEBUG] EventSource useEffect CLEANUP for OpId: ${opIdAtCleanup}. Current isLoadingRef: ${isLoadingRef.current}, confirmedNav: ${hasConfirmedNavigationRef.current}, currentOpIdRef: ${currentOperationIdRef.current}`);
      if (es) {
        console.log(`[DEBUG] EventSource useEffect CLEANUP: Closing 'es' instance for ${opIdAtCleanup}`);
        es.close();
      }
      if (eventSourceRef.current && eventSourceRef.current === es) {
         eventSourceRef.current = null;
      }

      // 이 cleanup은 currentOperationId 또는 isLoading 상태가 변경될 때 호출됨.
      // 명시적인 취소 요청은 handleSubmit, useBlocker, pagehide 핸들러에서 이미 처리하고 있으므로,
      // 이 useEffect cleanup에서는 EventSource 객체만 정리합니다.
      // 불필요한 cancel 요청을 방지하기 위해 sendCancelRequestToBackend 호출 로직을 제거합니다.
      let logMessage = `[DEBUG] EventSource useEffect CLEANUP for OpId ${opIdAtCleanup}. Conditions for cancel (would have been):`;
      logMessage += ` isLoadingRef: ${isLoadingRef.current}, confirmedNav: ${hasConfirmedNavigationRef.current}, isRefiningRef: ${isRefiningRef.current}, currentOpIdRef: ${currentOperationIdRef.current}`;
      console.log(logMessage);
      // if (opIdAtCleanup && 
      //     isLoadingRef.current && 
      //     !hasConfirmedNavigationRef.current && 
      //     !isRefiningRef.current && 
      //     opIdAtCleanup === currentOperationIdRef.current) {
      //      console.log(`[DEBUG] EventSource useEffect CLEANUP: Sending cancel for OpId ${opIdAtCleanup} as it's an active, unconfirmed closure (NOT a refine operation).`);
      //      sendCancelRequestToBackend(opIdAtCleanup);
      // } else {
      //   let logMessage = `[DEBUG] EventSource useEffect CLEANUP: Cancel request NOT sent for ${opIdAtCleanup}.`;
      //   logMessage += ` isLoadingRef: ${isLoadingRef.current}, confirmedNav: ${hasConfirmedNavigationRef.current}, isRefiningRef: ${isRefiningRef.current}, currentOpIdRef: ${currentOperationIdRef.current}`;
      //   console.log(logMessage);
      // }
    };
  }, [currentOperationId, isLoading]); 


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); 
    
    if (eventSourceRef.current) {
        console.log(`[DEBUG] handleSubmit: Closing existing EventSource (url: ${eventSourceRef.current.url}) for previous OpId ${currentOperationIdRef.current} before new submission.`);
        eventSourceRef.current.close();
        eventSourceRef.current = null;
    }
    if (currentOperationIdRef.current && isLoadingRef.current) { // 이전 작업이 로딩 중이었다면 취소
        console.log(`[DEBUG] handleSubmit: Sending cancel for previous active OpId ${currentOperationIdRef.current} before new submission.`);
        sendCancelRequestToBackend(currentOperationIdRef.current);
    }
    
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const fileInput = formElement.querySelector('input[type="file"]') as HTMLInputElement;
    
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        formData.append('encodedFileName', encodeURIComponent(file.name)); // 파일 이름 인코딩하여 추가
        console.log(`[DEBUG] handleSubmit: Appended encodedFileName: ${encodeURIComponent(file.name)}`);
    }


    const displayUrl = formData.get("jobPostingUrl") as string;
    
    setCurrentJobPostingUrl(displayUrl || "");
    setStreamedContent(""); 
    setAnalysisResult(null);
    setError(null);
    setFileName(null); // fileName은 initResponse에서 설정
    setDbRecordId(null);
    setUserFeedback("");
    hasConfirmedNavigationRef.current = false; 
    
    setIsLoading(true); 

    try {
      const initResponse = await fetch("http://localhost:3001/api/initiate-analysis", {
        method: "POST",
        body: formData,
      });

      const initData: InitialResponseData = await initResponse.json();

      if (!initResponse.ok || !initData.success || !initData.operationId) {
        console.error("[Frontend] Initiate analysis failed:", initData);
        setError(initData.error || "Failed to initiate analysis.");
        setIsLoading(false);
        setCurrentOperationId(null); 
        return;
      }
      
      console.log(`[DEBUG] handleSubmit: initData.operationId received: ${initData.operationId}.`);
      setFileName(initData.fileName || null); // 서버에서 decode된 파일 이름을 받음
      setCurrentOperationId(initData.operationId); 
      console.log(`[Frontend] Analysis initiated. New Operation ID: ${initData.operationId}. isLoading is now true.`);

    } catch (err: any) {
      console.error('[Frontend] Error in handleSubmit (initiate-analysis call):', err);
      setError(typeof err === 'string' ? err : err.error || err.message || "분석 시작 중 오류가 발생했습니다.");
      setIsLoading(false);
      setCurrentOperationId(null); 
    } 
  };

  const handleFeedbackChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserFeedback(event.target.value);
  };

  const handleRefineRequest = async () => {
    console.log("[DEBUG] handleRefineRequest called"); // 함수 호출 확인 로그 추가
    if (!currentOperationIdRef.current) {
      console.log("[DEBUG] handleRefineRequest: No currentOperationIdRef.current, returning.");
      setError("현재 진행 중인 분석 작업이 없어 개선 요청을 보낼 수 없습니다. 먼저 분석을 시작해주세요.");
      return;
    }
    if (!userFeedback.trim()) {
      console.log("[DEBUG] handleRefineRequest: userFeedback is empty, returning.");
      setError("피드백 또는 추가 요청사항을 입력해주세요.");
      return;
    }

    console.log(`[DEBUG] handleRefineRequest: Initiating refinement for OpId ${currentOperationIdRef.current} with feedback: ${userFeedback}`);
    
    // 이전 EventSource가 있다면 명시적으로 닫기
    if (eventSourceRef.current) {
      console.log(`[DEBUG] handleRefineRequest: Closing existing EventSource before sending refine request for OpId ${currentOperationIdRef.current}`);
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    // 상태 초기화 및 로딩 시작
    // isLoading은 이미 true일 수 있으나, 명시적으로 다시 설정하여 useEffect 트리거를 유도할 수도 있음.
    // 또는 별도의 isRefining 상태를 사용할 수도 있음. 여기서는 isLoading을 재활용.
    setError(null);
    setStreamedContent(""); // 이 상태는 이제 사용하지 않으므로 관련 로직 제거 가능 (추후)
    setAnalysisResult(null);  // 이전 분석 결과 화면에서 제거 (새 결과가 스트리밍될 것이므로)
    setIsRefining(true); // 개선 작업 시작 플래그
    setIsLoading(true); // 로딩 상태 활성화 (useEffect가 새 EventSource를 만들도록 유도)
    hasConfirmedNavigationRef.current = false; // 새 작업 시작이므로 네비게이션 확인 플래그 리셋

    try {
      // 백엔드에 개선 요청 준비 API 호출
      const refinePrepareResponse = await fetch("http://localhost:3001/api/refine-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: currentOperationIdRef.current,
          section: "suggestedResumeMarkdown", // 또는 사용자가 선택한 섹션, 여기서는 전체 재작성 유도
          userInput: userFeedback,
          previousMarkdown: analysisResult?.suggestedResumeMarkdown || "", // 이전 마크다운 전달
        }),
      });

      const prepareData = await refinePrepareResponse.json();

      if (!refinePrepareResponse.ok || !prepareData.success) {
        console.error("[Frontend] Refine prepare request failed:", prepareData);
        setError(prepareData.message || "개선 요청 준비에 실패했습니다.");
        setIsLoading(false);
        setIsRefining(false);
        // setCurrentOperationId(null); // operationId는 유지해야 SSE 재연결 시도
        return;
      }

      console.log(`[DEBUG] handleRefineRequest: Refine prepare request successful for OpId ${currentOperationIdRef.current}. Message: ${prepareData.message}`);
      // 백엔드가 기존 스트림을 중단하고 refinementDetails를 설정했으므로,
      // 프론트엔드는 동일한 currentOperationId와 isLoading=true 상태로 useEffect를 통해
      // 새로운 EventSource 연결을 맺게 됩니다.
      // setCurrentOperationId(currentOperationIdRef.current); // 이 호출은 상태가 변경되지 않으면 useEffect를 트리거하지 않을 수 있음.
      // 대신, isLoading이 true이고 currentOperationId가 설정되어 있으면 useEffect가 실행됨.
      // 이미 setIsLoading(true)를 호출했으므로, useEffect가 currentOperationId를 사용하여 새 연결을 시도할 것임.
      // 만약 useEffect가 currentOperationId의 '변경'에만 반응한다면,
      // setCurrentOperationId(null); setTimeout(() => setCurrentOperationId(currentOperationIdRef.current!), 0); 와 같은 트릭이 필요할 수 있으나,
      // 현재 useEffect는 isLoading의 변경에도 반응하므로 괜찮을 것으로 예상.

    } catch (err: any) {
      console.error('[Frontend] Error in handleRefineRequest (refine-analysis call):', err);
      setError(err.message || "개선 요청 중 오류가 발생했습니다.");
      setIsLoading(false);
      setIsRefining(false);
      // setCurrentOperationId(null); // 오류 발생 시 operationId 유지 여부 결정 필요
    }
    // setIsLoading(false) 및 setIsRefining(false)는 SSE 스트림의 'complete' 또는 'error' 이벤트에서 처리됨.
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
        <ResumeAnalysisForm isLoading={isLoading} onSubmit={handleSubmit} />

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

        {analysisResult && !isLoading && (
          <>
            <AnalysisResultDisplay analysisResult={analysisResult} fileName={fileName} />
            <FeedbackForm
              isLoading={isLoading}
              userFeedback={userFeedback}
              onFeedbackChange={handleFeedbackChange}
              onRefineRequest={handleRefineRequest}
            />
          </>
        )}
        {/* streamedContent를 직접 표시하는 대신 AnalysisResultDisplay가 analysisResult.suggestedResumeMarkdown을 표시 */}
        {/* isLoading 중에도 analysisResult가 부분적으로 채워지면서 AnalysisResultDisplay에 의해 렌더링될 수 있음 */}
        {/* 또는, analysisResult가 null이고 isLoading일 때만 별도의 로딩 메시지를 보여주고,
            analysisResult가 채워지기 시작하면 (suggestedResumeMarkdown이라도) AnalysisResultDisplay를 보여주는 방식도 가능 */}
        {isLoading && !analysisResult?.summary && ( // summary가 아직 없을 때 (스트리밍 초기)
           <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-md prose dark:prose-invert max-w-none"> {/* prose 스타일 추가 */}
             <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">분석 결과 (실시간)</h3>
             {analysisResult?.suggestedResumeMarkdown ? (
               <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysisResult.suggestedResumeMarkdown}</ReactMarkdown>
             ) : (
               <p className="text-sm text-gray-500 dark:text-gray-400">결과를 가져오는 중...</p>
             )}
           </div>
        )}
      </div>
    </div>
  );
}
