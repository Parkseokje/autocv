import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  DocumentTextIcon,
  WrenchScrewdriverIcon, // 또는 CodeBracketIcon
  SparklesIcon,         // 또는 CheckBadgeIcon
  LightBulbIcon,
  ClipboardDocumentCheckIcon, // 또는 DocumentDuplicateIcon
} from '@heroicons/react/24/outline';

interface AnalysisResult {
  summary?: string;
  skills?: string[];
  strengths?: string[];
  improvementSuggestions?: string[];
  suggestedResumeMarkdown?: string;
}

interface AnalysisResultDisplayProps {
  analysisResult: AnalysisResult | null;
  fileName: string | null;
}

export default function AnalysisResultDisplay({ analysisResult, fileName }: AnalysisResultDisplayProps) {
  if (!analysisResult) {
    return null;
  }

  const handleCopyToClipboard = () => {
    if (analysisResult.suggestedResumeMarkdown) {
      navigator.clipboard.writeText(analysisResult.suggestedResumeMarkdown)
        .then(() => alert("마크다운 이력서가 클립보드에 복사되었습니다!"))
        .catch(err => {
          console.error("클립보드 복사 실패:", err);
          alert("클립보드 복사에 실패했습니다.");
        });
    }
  };

  const handleDownloadPdf = async () => {
    if (analysisResult.suggestedResumeMarkdown) {
      try {
        const response = await fetch("http://localhost:3001/api/download-pdf", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            markdownContent: analysisResult.suggestedResumeMarkdown,
            fileName: fileName || "ai_generated_resume",
          }),
        });
        if (!response.ok) {
          throw new Error(`PDF 다운로드 실패: ${response.statusText}`);
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const pdfFileName = `${(fileName || "resume").split('.')[0]}.pdf`;
        a.download = pdfFileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        alert("PDF 파일 다운로드가 시작됩니다.");
      } catch (pdfError: any) {
        console.error("PDF 다운로드 오류:", pdfError);
        alert(`PDF 다운로드 중 오류 발생: ${pdfError.message}`);
      }
    }
  };

  return (
    <div className="mt-8 p-6 bg-white dark:bg-gray-800 shadow-xl rounded-lg w-full max-w-2xl mb-8 space-y-8"> {/* Added space-y-8 for spacing between cards */}
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center"> {/* mb-6 and text-center */}
        '{fileName || "업로드된 파일"}' 분석 결과
      </h2>
      
      {analysisResult.summary && (
        <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow">
          <h3 className="flex items-center text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
            <DocumentTextIcon className="h-6 w-6 mr-2 text-blue-500" />
            요약
          </h3>
          <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{analysisResult.summary}</p>
        </div>
      )}

      {analysisResult.skills && analysisResult.skills.length > 0 && (
        <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow">
          <h3 className="flex items-center text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
            <WrenchScrewdriverIcon className="h-6 w-6 mr-2 text-blue-500" />
            주요 기술
          </h3>
          <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
            {analysisResult.skills.map((skill, index) => (
              <li key={index}>{skill}</li>
            ))}
          </ul>
        </div>
      )}

      {analysisResult.strengths && analysisResult.strengths.length > 0 && (
        <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow">
          <h3 className="flex items-center text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
            <SparklesIcon className="h-6 w-6 mr-2 text-blue-500" />
            강점
          </h3>
          <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
            {analysisResult.strengths.map((strength, index) => (
              <li key={index}>{strength}</li>
            ))}
          </ul>
        </div>
      )}

      {analysisResult.improvementSuggestions && analysisResult.improvementSuggestions.length > 0 && (
        <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow">
          <h3 className="flex items-center text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
            <LightBulbIcon className="h-6 w-6 mr-2 text-blue-500" />
            이력서 개선 제안
          </h3>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-300"> {/* Removed space-y-1, will add margin to li */}
            {analysisResult.improvementSuggestions.map((item, index) => (
              <li key={index} className="whitespace-pre-wrap mb-2"> {/* Added mb-2 for spacing between items */}
                {typeof item === 'string' ? item : (item && typeof item === 'object' && 'suggestion' in item ? (item as any).suggestion : JSON.stringify(item))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysisResult.suggestedResumeMarkdown && (
        <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg shadow">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
            <h3 className="flex items-center text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2 sm:mb-0">
              <ClipboardDocumentCheckIcon className="h-6 w-6 mr-2 text-blue-500" />
              AI 추천 이력서 (Markdown)
            </h3>
            <div className="flex-shrink-0">
              <button
                onClick={handleCopyToClipboard}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                마크다운 복사
              </button>
              <button
                onClick={handleDownloadPdf}
                className="ml-2 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                PDF로 다운로드
              </button>
            </div>
          </div>
          <div className="prose dark:prose-invert max-w-none p-4 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysisResult.suggestedResumeMarkdown}</ReactMarkdown>
          </div>
        </div>
      )}
      
      {!analysisResult.summary && (!analysisResult.skills || analysisResult.skills.length === 0) && (!analysisResult.strengths || analysisResult.strengths.length === 0) && (!analysisResult.improvementSuggestions || analysisResult.improvementSuggestions.length === 0) && !analysisResult.suggestedResumeMarkdown && (
         <p className="text-gray-600 dark:text-gray-300">분석된 내용이 없습니다. 다른 파일을 시도해보세요.</p>
      )}
    </div>
  );
}
