import { Link } from "@remix-run/react";
import { useInView } from "react-intersection-observer";

export default function BottomCallToAction() {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <div
      ref={ref}
      className={`w-full bg-blue-600 dark:bg-blue-700 transition-all duration-700 ease-out ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:px-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          준비되셨나요?
          <br />
          지금 바로 최고의 이력서를 만들어보세요!
        </h2>
        <p className="mt-6 text-lg leading-8 text-blue-100 dark:text-blue-200 max-w-2xl mx-auto">
          AI 이력서 자동 완성의 강력한 기능을 경험하고, 원하는 기업으로부터 연락받을 기회를 놓치지 마세요.
        </p>
        <div className="mt-10">
          <Link
            to="/analysis"
            className="rounded-md bg-white dark:bg-gray-100 px-3.5 py-2.5 text-sm font-semibold text-blue-600 dark:text-blue-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white dark:focus-visible:outline-gray-100"
          >
            AI 이력서 컨설팅 시작하기 &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
