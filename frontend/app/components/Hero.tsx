import { Link } from "@remix-run/react";
import { useInView } from "react-intersection-observer";

export default function Hero() {
  const { ref, inView } = useInView({
    triggerOnce: true, // 한 번만 애니메이션 실행
    threshold: 0.1, // 요소의 10%가 보일 때 실행
  });

  return (
    <div
      ref={ref}
      className={`w-full bg-gray-100 dark:bg-gray-900 transition-all duration-700 ease-out ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center py-16 md:py-24">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white mb-6">
          AI가 당신의 이력서를 <span className="text-blue-600 dark:text-blue-500">합격 수준</span>으로 바꿔드립니다.
      </h1>
        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-3xl mx-auto"> {/* 문단 너비 약간 조정 */}
          이력서와 채용 공고를 올리면, AI가 맞춤형 개선안을 제시하고 새로운 이력서를 생성합니다.
        </p>
        <Link
          to="/analysis"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg text-lg shadow-md hover:shadow-lg transition duration-300 ease-in-out transform hover:-translate-y-1 inline-block"
        >
          AI 이력서 컨설팅 시작하기
        </Link>
      </div>
    </div>
  );
}
