import { ArrowUpTrayIcon, SparklesIcon, DocumentCheckIcon } from '@heroicons/react/24/outline';
import { useInView } from 'react-intersection-observer';

const steps = [
  {
    name: '1단계: 정보 업로드',
    description: '가지고 계신 이력서 파일(PDF, DOCX)을 업로드하고, 목표하는 채용 공고가 있다면 URL을 함께 입력해주세요. AI가 분석을 시작합니다.',
    icon: ArrowUpTrayIcon,
  },
  {
    name: '2단계: AI 분석 및 제안 확인',
    description: 'AI가 업로드된 정보와 채용 공고를 심층 분석하여, 맞춤형 개선 제안과 함께 새로운 이력서 초안을 생성합니다. 핵심 강점과 보완점을 한눈에 파악하세요.',
    icon: SparklesIcon,
  },
  {
    name: '3단계: 이력서 완성 및 활용',
    description: 'AI가 제안한 이력서를 확인하고, 필요하다면 피드백을 통해 더욱 완벽하게 다듬으세요. 완성된 이력서는 마크다운으로 복사하거나 PDF로 바로 다운로드할 수 있습니다.',
    icon: DocumentCheckIcon,
  },
];

export default function HowItWorks() {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <div
      ref={ref}
      className={`w-full bg-gray-50 dark:bg-gray-900 py-16 sm:py-24 transition-all duration-700 ease-out ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600 dark:text-blue-400">간편한 사용 방법</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            AI 이력서, 단 3단계로 완성!
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            복잡한 과정 없이 누구나 쉽게 최고의 이력서를 만들 수 있도록, AI 이력서 자동 완성이 도와드립니다.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-3 lg:gap-y-16">
            {steps.map((step) => (
              <div key={step.name} className="flex flex-col items-center text-center p-6 rounded-lg hover:shadow-xl transition-shadow duration-300 bg-white dark:bg-gray-800">
                <dt className="flex flex-col items-center gap-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 dark:bg-blue-500">
                    <step.icon className="h-7 w-7 text-white" aria-hidden="true" />
                  </div>
                  <p className="text-xl font-semibold leading-7 text-gray-900 dark:text-white">{step.name}</p>
                </dt>
                <dd className="mt-3 text-base leading-7 text-gray-600 dark:text-gray-300">{step.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
