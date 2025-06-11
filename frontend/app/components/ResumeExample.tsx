import { ChatBubbleBottomCenterTextIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useInView } from 'react-intersection-observer';

const beforeResume = `
**프로젝트 경험**
- 쇼핑몰 웹사이트 개발 참여 (2023.01 ~ 2023.06)
  - 주요 기능 개발
  - HTML, CSS, JavaScript 사용
`;

const beforeComments = [
  "수행 역할과 성과가 구체적이지 않아요.",
  "사용된 기술 스택만 나열되어, 어떤 수준으로 활용했는지 알기 어려워요.",
  "프로젝트의 목표나 결과에 대한 언급이 없어요.",
];

const afterResume = `
**주요 프로젝트 경험**
- **E-커머스 플랫폼 'AwesomeShop' 프론트엔드 개발 (2023.01 ~ 2023.06)**
  - **역할:** React 기반 UI 개발 및 사용자 인터랙션 구현 담당
  - **주요 성과:**
    - 상품 상세 페이지 로딩 속도 20% 개선 (Lighthouse 기준)
    - 반응형 디자인 적용으로 모바일 사용자 경험 증대 (이탈률 5% 감소)
  - **사용 기술:** React, Redux, TypeScript, Styled-components
`;

const afterComments = [
  "프로젝트명과 역할을 명확히 하고, 구체적인 성과를 수치로 제시했어요.",
  "핵심 기술과 함께 어떤 부분에 기여했는지 명시하여 전문성을 어필해요.",
  "성과 중심의 표현으로 변경하여 인사담당자의 시선을 사로잡아요.",
];

export default function ResumeExample() {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <div
      ref={ref}
      className={`w-full bg-white dark:bg-gray-800 py-16 sm:py-24 transition-all duration-700 ease-out ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600 dark:text-blue-400">실제 개선 사례</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            AI로 이렇게 달라집니다
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            AI 이력서 자동 완성의 강력한 컨설팅 효과를 직접 확인해보세요. 작은 변화가 큰 차이를 만듭니다.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:mt-20 lg:mt-24 lg:mx-0 lg:max-w-none lg:grid-cols-2">
          {/* Before Section */}
          <div className="flex flex-col rounded-xl bg-gray-50 dark:bg-gray-900/80 p-8 ring-1 ring-inset ring-gray-200 dark:ring-gray-700">
            <h3 className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400 flex items-center">
              <XCircleIcon className="h-8 w-8 mr-2" aria-hidden="true" />
              개선 전 이력서 (예시)
            </h3>
            <div className="mt-6 prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-4 rounded-md shadow">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{beforeResume}</ReactMarkdown>
            </div>
            <div className="mt-6">
              <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
                <ChatBubbleBottomCenterTextIcon className="h-6 w-6 mr-2 text-red-500 dark:text-red-400" aria-hidden="true" />
                AI 코멘트 (개선 필요)
              </h4>
              <ul className="mt-3 list-disc list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                {beforeComments.map((comment, index) => (
                  <li key={index}>{comment}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* After Section */}
          <div className="flex flex-col rounded-xl bg-green-50 dark:bg-green-900/30 p-8 ring-1 ring-inset ring-green-200 dark:ring-green-700">
            <h3 className="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400 flex items-center">
              <CheckCircleIcon className="h-8 w-8 mr-2" aria-hidden="true" />
              AI 추천 개선안 (예시)
            </h3>
            <div className="mt-6 prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-4 rounded-md shadow">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{afterResume}</ReactMarkdown>
            </div>
            <div className="mt-6">
              <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
                <ChatBubbleBottomCenterTextIcon className="h-6 w-6 mr-2 text-green-500 dark:text-green-400" aria-hidden="true" />
                AI 코멘트 (주요 개선점)
              </h4>
              <ul className="mt-3 list-disc list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                {afterComments.map((comment, index) => (
                  <li key={index}>{comment}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
