interface FeedbackFormProps {
  isLoading: boolean;
  userFeedback: string;
  onFeedbackChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onRefineRequest: () => void;
}

export default function FeedbackForm({
  isLoading,
  userFeedback,
  onFeedbackChange,
  onRefineRequest,
}: FeedbackFormProps) {
  return (
    <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-700 shadow-md rounded-lg w-full max-w-2xl">
      <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">
        AI 분석 결과에 대한 피드백 또는 추가 요청사항
      </h3>
      <textarea
        name="userFeedback"
        rows={4}
        value={userFeedback}
        onChange={onFeedbackChange}
        className="block w-full text-sm text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-gray-800 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 mb-3"
        placeholder="예: '요약 부분에서 A 경험을 더 강조해주세요.' 또는 '기술 스택에 B 기술을 추가하고 싶습니다.'"
      />
      <button
        type="button"
        onClick={onRefineRequest}
        disabled={isLoading}
        className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:bg-green-500 dark:hover:bg-green-600 dark:focus:ring-offset-gray-800 disabled:opacity-50"
      >
        {isLoading ? "최적화 중..." : "피드백 반영하여 추가 최적화 요청"}
      </button>
    </div>
  );
}
