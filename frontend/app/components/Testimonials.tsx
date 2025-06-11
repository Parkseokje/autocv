import { StarIcon, UserCircleIcon } from '@heroicons/react/24/solid'; // Using solid icons for filled stars
import { useInView } from 'react-intersection-observer';

const testimonials = [
  {
    id: 1,
    quote:
      "이력서 쓰는 게 늘 막막했는데, AI가 제 경험을 바탕으로 핵심만 쏙쏙 뽑아주니 정말 신기했어요! 덕분에 서류 합격률이 눈에 띄게 올랐습니다. 주변 친구들에게도 강력 추천하고 있어요!",
    author: {
      name: '김O O 님',
      role: 'UI/UX 디자이너 지망생',
      avatar: UserCircleIcon, // Placeholder avatar
    },
    rating: 5,
  },
  {
    id: 2,
    quote:
      "경력직이라 이직 준비가 더 부담스러웠는데, 채용 공고에 맞춰 이력서를 최적화해주는 기능이 정말 유용했습니다. AI 컨설팅 받고 원하는 회사로 이직 성공했어요! 시간도 절약되고 결과도 만족스럽습니다.",
    author: {
      name: '이O O 님',
      role: '5년차 소프트웨어 엔지니어',
      avatar: UserCircleIcon,
    },
    rating: 5,
  },
  {
    id: 3,
    quote:
      "AI가 제안해준 문장들이 너무 자연스럽고 전문적이어서 놀랐어요. 피드백 기능으로 제가 원하는 방향으로 수정하기도 쉬웠고요. 덕분에 서류 작성 시간을 크게 줄일 수 있었습니다. 강력 추천합니다!",
    author: {
      name: '최O O 님',
      role: '신입 마케터',
      avatar: UserCircleIcon,
    },
    rating: 4, // Example of a different rating
  },
];

export default function Testimonials() {
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
          <h2 className="text-base font-semibold leading-7 text-blue-600 dark:text-blue-400">사용자 후기</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            AI 이력서 자동 완성, 사용자들은 이렇게 말합니다!
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:mt-20 lg:mt-24 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div key={testimonial.id} className="flex flex-col rounded-xl bg-gray-50 dark:bg-gray-900/80 p-8 ring-1 ring-inset ring-gray-200 dark:ring-gray-700">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    className={`h-5 w-5 ${i < testimonial.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <blockquote className="text-gray-700 dark:text-gray-300">
                <p className="text-lg leading-7">&ldquo;{testimonial.quote}&rdquo;</p>
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-x-4">
                <testimonial.author.avatar className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 p-1" />
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{testimonial.author.name}</div>
                  <div className="text-gray-600 dark:text-gray-400">{testimonial.author.role}</div>
                </div>
              </figcaption>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
