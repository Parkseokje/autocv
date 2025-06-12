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
    if (operationId !== currentOperationIdRef.current && currentOperationIdRef.current !== null) {
        // console.log(`[DEBUG] sendCancelRequestToBackend: OpId ${operationId} does not match currentOpIdRef ${currentOperationIdRef.current}. Not sending.`);
        // return; 
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
  }, []);

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
            setAnalysisResult((prev) => {
              const newMarkdown = (prev?.suggestedResumeMarkdown || "") + eventData.chunk;
              if (prev === null && isLoading && !isRefining) {
                return { suggestedResumeMarkdown: newMarkdown };
              }
              if (prev === null && isRefining) {
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
        setIsRefining(false); 
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
        setIsRefining(false); 
        setCurrentOperationId(null); 
        es?.close(); 
        eventSourceRef.current = null;
        console.log(`[DEBUG] EventSource closed on 'error' for opId ${operationIdForEffect}`);
      };
    }

    return () => {
      const opIdAtCleanup = operationIdForEffect; 
      console.log(`[DEBUG] EventSource useEffect CLEANUP for OpId: ${opIdAtCleanup}. Current isLoadingRef: ${isLoadingRef.current}, confirmedNav: ${hasConfirmedNavigationRef.current}, currentOpIdRef: ${currentOperationIdRef.current}`);
      if (es) {
        console.log(`[DEBUG] EventSource useEffect CLEANUP: Closing 'es' instance for ${opIdAtCleanup}`);
        es.close();
      }
      if (eventSourceRef.current && eventSourceRef.current === es) {
         eventSourceRef.current = null;
      }
      let logMessage = `[DEBUG] EventSource useEffect CLEANUP for OpId ${opIdAtCleanup}. Conditions for cancel (would have been):`;
      logMessage += ` isLoadingRef: ${isLoadingRef.current}, confirmedNav: ${hasConfirmedNavigationRef.current}, isRefiningRef: ${isRefiningRef.current}, currentOpIdRef: ${currentOperationIdRef.current}`;
      console.log(logMessage);
    };
  }, [currentOperationId, isLoading]); 


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); 
    
    if (eventSourceRef.current) {
        console.log(`[DEBUG] handleSubmit: Closing existing EventSource (url: ${eventSourceRef.current.url}) for previous OpId ${currentOperationIdRef.current} before new submission.`);
        eventSourceRef.current.close();
        eventSourceRef.current = null;
    }
    if (currentOperationIdRef.current && isLoadingRef.current) { 
        console.log(`[DEBUG] handleSubmit: Sending cancel for previous active OpId ${currentOperationIdRef.current} before new submission.`);
        sendCancelRequestToBackend(currentOperationIdRef.current);
    }
    
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const fileInput = formElement.querySelector('input[type="file"]') as HTMLInputElement;
    
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        formData.append('encodedFileName', encodeURIComponent(file.name)); 
        console.log(`[DEBUG] handleSubmit: Appended encodedFileName: ${encodeURIComponent(file.name)}`);
    }

    const displayUrl = formData.get("jobPostingUrl") as string;
    
    setCurrentJobPostingUrl(displayUrl || "");
    setStreamedContent(""); 
    setAnalysisResult(null);
    setError(null);
    setFileName(null); 
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
      setFileName(initData.fileName || null); 
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
    console.log("[DEBUG] handleRefineRequest called"); 
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
    
    if (eventSourceRef.current) {
      console.log(`[DEBUG] handleRefineRequest: Closing existing EventSource before sending refine request for OpId ${currentOperationIdRef.current}`);
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setError(null);
    setStreamedContent(""); 
    setAnalysisResult(null);  
    setIsRefining(true); 
    setIsLoading(true); 
    hasConfirmedNavigationRef.current = false; 

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
        console.error("[Frontend] Refine prepare request failed:", prepareData);
        setError(prepareData.message || "개선 요청 준비에 실패했습니다.");
        setIsLoading(false);
        setIsRefining(false);
        return;
      }

      console.log(`[DEBUG] handleRefineRequest: Refine prepare request successful for OpId ${currentOperationIdRef.current}. Message: ${prepareData.message}`);
    } catch (err: any) {
      console.error('[Frontend] Error in handleRefineRequest (refine-analysis call):', err);
      setError(err.message || "개선 요청 중 오류가 발생했습니다.");
      setIsLoading(false);
      setIsRefining(false);
    }
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
                onRefineRequest={handleRefineRequest}
              />
            )}
          </>
        )}
        {/* "분석 결과 (실시간)" 섹션은 사용자 요청에 따라 제거되었습니다. */}
      </div>
    </div>
  );
}
