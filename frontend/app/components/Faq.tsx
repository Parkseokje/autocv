import { DisclosurePanel, DisclosureButton, Disclosure } from '@headlessui/react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useInView } from 'react-intersection-observer';

const faqs = [
  {
    question: "AI 분석은 어떤 원리로 작동하나요?",
    answer:
      "저희 서비스는 Google의 최첨단 언어 모델인 Vertex AI Gemini Pro를 사용합니다. 이 모델은 이력서와 채용 공고의 문맥을 깊이 이해하고, 수많은 합격 데이터를 기반으로 개인에게 최적화된 개선안과 새로운 이력서 초안을 생성합니다.",
  },
  {
    question: "제 개인정보와 이력서 파일은 안전하게 관리되나요?",
    answer:
      "네, 사용자의 개인정보와 업로드된 파일의 보안을 매우 중요하게 생각합니다. 모든 데이터는 암호화되어 안전하게 처리되며, 서비스 제공 및 개선 목적 외에는 절대 사용되지 않습니다. (추후 개인정보처리방침 페이지 링크 예정)",
  },
  {
    question: "어떤 파일 형식을 지원하나요?",
    answer:
      "현재 PDF (.pdf) 및 Microsoft Word (.doc, .docx) 형식의 이력서 파일을 지원하고 있습니다.",
  },
  {
    question: "AI가 생성한 이력서가 만족스럽지 않으면 어떻게 하나요?",
    answer:
      "AI가 제안한 이력서 초안에 대해 구체적인 피드백(예: 'A 경험을 더 강조해주세요', 'B 기술 관련 내용을 추가해주세요')을 제공해주시면, AI가 해당 피드백을 반영하여 내용을 추가적으로 수정하고 개선해드립니다. 양방향 소통을 통해 만족스러운 결과를 얻으실 수 있습니다.",
  },
  {
    question: "서비스 이용 요금은 어떻게 되나요?",
    answer:
      "현재 MVP 버전에서는 핵심 기능인 이력서 분석, 마크다운 생성, PDF 다운로드 등을 무료로 제공하고 있습니다. 향후 더 다양한 기능이 추가되면서 일부 고급 기능에 대해서는 유료화 모델을 고려하고 있습니다.",
  },
];

export default function Faq() {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <div
      ref={ref}
      className={`w-full bg-gray-50 dark:bg-gray-900 transition-all duration-700 ease-out ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8 lg:py-40">
        <div className="mx-auto max-w-4xl divide-y divide-gray-900/10 dark:divide-white/10">
          <h2 className="text-2xl font-bold leading-10 tracking-tight text-gray-900 dark:text-white">자주 묻는 질문 (FAQ)</h2>
          <dl className="mt-10 space-y-6 divide-y divide-gray-900/10 dark:divide-white/10">
            {faqs.map((faq) => (
              <Disclosure as="div" key={faq.question} className="pt-6">
                {({ open }) => (
                  <>
                    <dt>
                      <DisclosureButton className="flex w-full items-start justify-between text-left text-gray-900 dark:text-white">
                        <span className="text-base font-semibold leading-7">{faq.question}</span>
                        <span className="ml-6 flex h-7 items-center">
                          {open ? (
                            <ChevronUpIcon className="h-6 w-6" aria-hidden="true" />
                          ) : (
                            <ChevronDownIcon className="h-6 w-6" aria-hidden="true" />
                          )}
                        </span>
                      </DisclosureButton>
                    </dt>
                    <DisclosurePanel as="dd" className="mt-2 pr-12">
                      <p className="text-base leading-7 text-gray-600 dark:text-gray-300 break-words">{faq.answer}</p>
                    </DisclosurePanel>
                  </>
                )}
              </Disclosure>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
