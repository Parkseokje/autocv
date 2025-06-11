import BriefcaseIcon from '@heroicons/react/24/outline/BriefcaseIcon';
import LightBulbIcon from '@heroicons/react/24/outline/LightBulbIcon';
import ClockIcon from '@heroicons/react/24/outline/ClockIcon';
import SparklesIcon from '@heroicons/react/24/outline/SparklesIcon';
import { useInView } from 'react-intersection-observer';

export default function ServiceIntroduction() {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const features = [
    {
      name: '정교한 AI 분석',
      description: 'Google의 Vertex AI Gemini Pro 모델을 기반으로 이력서와 채용 공고를 심층 분석하여 최적의 개선점을 도출합니다.',
      icon: LightBulbIcon,
    },
    {
      name: '채용 공고 맞춤 최적화',
      description: '지원하는 직무의 요구사항과 핵심 키워드를 정확히 파악하여, 합격 가능성을 높이는 맞춤형 이력서를 제안합니다.',
      icon: BriefcaseIcon,
    },
    {
      name: '획기적인 시간 절약',
      description: '단 몇 분 만에 전문가 수준의 이력서 초안을 완성하여, 소중한 시간을 아껴드립니다. 반복적인 수정 작업도 간편하게 처리하세요.',
      icon: ClockIcon,
    },
    {
      name: '지속적인 발전과 개선',
      description: '사용자 피드백을 통해 AI 모델은 꾸준히 학습하고 발전합니다. 항상 최신의 채용 트렌드를 반영한 컨설팅을 제공합니다.',
      icon: SparklesIcon,
    },
  ];

  return (
    <div
      ref={ref}
      className={`w-full bg-white dark:bg-gray-800 py-16 sm:py-24 transition-all duration-700 ease-out ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600 dark:text-blue-400">AI 이력서 자동 완성</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            당신의 커리어를 혁신하세요
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            최첨단 AI 기술로 이력서 작성의 어려움을 해결하고, 꿈의 직업에 한 걸음 더 다가가세요. 
            AI 이력서 자동 완성은 Google의 강력한 Vertex AI Gemini Pro 모델을 기반으로, 단순한 문서 수정을 넘어 당신의 경험과 역량을 가장 효과적으로 어필할 수 있도록 돕는 지능형 파트너입니다.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
            {features.map((feature) => (
              <div key={feature.name} className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900 dark:text-white">
                  <feature.icon className="h-8 w-8 flex-none text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  {feature.name}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-300">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-12 text-center text-md leading-8 text-gray-700 dark:text-gray-400">
          <p>이력서 파일을 업로드하고, 목표하는 채용 공고 URL을 입력하기만 하면, AI가 수많은 합격 사례와 최신 트렌드를 분석하여 당신만을 위한 맞춤형 이력서를 생성합니다.
          시간이 부족한 취업 준비생부터 새로운 도전을 꿈꾸는 경력직까지, AI 이력서 자동 완성이 당신의 성공적인 커리어 여정에 든든한 지원군이 되어드릴 것입니다.</p>
        </div>
      </div>
    </div>
  );
}
