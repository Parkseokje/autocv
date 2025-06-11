// app/root.tsx

import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";

// ✨ 1단계: Tailwind CSS 파일을 Vite의 ?url 접미사를 사용하여 임포트합니다.
//    이렇게 하면 Vite가 이 파일을 빌드하고, 빌드된 파일의 공개 URL을 tailwindStylesHref에 할당합니다.
import tailwindStylesHref from "./tailwind.css?url";

export const links: LinksFunction = () => [
  // ✨ 2단계: tailwindStylesHref 변수에 담긴 빌드된 CSS 파일의 URL을 사용하여 <link> 태그를 생성합니다.
  { rel: "stylesheet", href: tailwindStylesHref },

  // 기존 Google Fonts 링크는 그대로 유지합니다.
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        {/* Links 컴포넌트가 links Function에서 반환된 모든 <link> 태그를 여기에 삽입합니다. */}
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}