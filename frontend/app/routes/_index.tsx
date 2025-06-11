import type { MetaFunction } from "@remix-run/node";
import Hero from "~/components/Hero";
import ServiceIntroduction from "~/components/ServiceIntroduction";
import HowItWorks from "~/components/HowItWorks";
import ResumeExample from "~/components/ResumeExample";
import Testimonials from "~/components/Testimonials";
import Faq from "~/components/Faq";
import BottomCallToAction from "~/components/BottomCallToAction"; // BottomCallToAction 컴포넌트 import

export const meta: MetaFunction = () => {
  return [
    { title: "AI 이력서 자동 완성" },
    { name: "description", content: "AI가 당신의 이력서를 합격 수준으로 바꿔드립니다. 이력서와 채용 공고를 분석하여 맞춤형 개선안을 제시하고 새로운 이력서를 생성합니다." },
  ];
};

export default function Index() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center">
      <Hero />
      <ServiceIntroduction />
      <HowItWorks />
      <ResumeExample />
      <Testimonials />
      <Faq />
      <BottomCallToAction />
      {/* 추가적인 랜딩 페이지 섹션들이 여기에 올 수 있습니다. */}
    </div>
  );
}

// ActionFunctionArgs, Form, useActionData, unstable_parseMultipartFormData, unstable_createMemoryUploadHandler,
// useState, useEffect, useRef, ReactMarkdown, remarkGfm 등은
// /analysis 라우트로 옮겨지므로 여기서는 제거합니다.
// AnalysisResult, ActionData 인터페이스도 /analysis 로 이동합니다.
// handleSubmit, handleFeedbackChange, handleRefineRequest, scrollToForm 함수도 제거합니다.
// action 함수도 /analysis 로 이동합니다.
