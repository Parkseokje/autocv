require("dotenv").config(); // .env 파일 로드

const { GoogleGenAI } = require("@google/genai");
// Vertex AI 클라이언트 초기화 설정
const projectId = process.env.GCP_PROJECT_ID;
const location = process.env.GCP_LOCATION;
const modelId =
  process.env.VERTEX_AI_MODEL_ID || "gemini-2.5-pro-preview-05-06";

let genAIInstance;

try {
  if (!projectId || !location) {
    throw new Error(
      "환경 변수 GCP_PROJECT_ID와 GCP_LOCATION이 모두 설정되어야 합니다. .env 파일을 확인해주세요."
    );
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn(
      "GOOGLE_APPLICATION_CREDENTIALS 환경 변수가 설정되지 않았습니다. Vertex AI 인증에 실패할 수 있습니다."
    );
  }

  genAIInstance = new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location: location
  });
  console.log(
    `GoogleGenAI 인스턴스가 성공적으로 초기화되었습니다. (프로젝트: ${projectId}, 위치: ${location}, 모델 ID: ${modelId})`
  );
} catch (initError) {
  console.error("GoogleGenAI 인스턴스 초기화 오류:", initError.message, initError.stack);
  genAIInstance = null;
}

async function analyzeResumeWithVertexAIStream(
  resumeText,
  jobPostingText = "",
  abortSignal = null,
  refinementDetails = null // refinementDetails 파라미터 추가
) {
  if (!genAIInstance) {
    throw new Error(
      "GoogleGenAI 인스턴스가 초기화되지 않았습니다. 서버 시작 시 로그에서 초기화 오류를 확인하세요."
    );
  }
  if (!resumeText || resumeText.trim() === "") {
    throw new Error("이력서 텍스트는 비어 있을 수 없습니다.");
  }

  let prompt;

  // 공통 출력 지침
  const commonOutputInstruction = `
    당신은 오직 JSON 데이터만을 생성하고 반환하는 API 역할을 수행합니다.
    응답은 처음부터 끝까지 **반드시 단 하나의 JSON 코드 블록(\`\`\`json ... \`\`\`)으로만 구성**되어야 합니다.
    이 JSON 코드 블록의 시작 전이나 종료 후에는 **어떠한 종류의 추가 텍스트, 설명, 인사, 주석, 공백, 줄바꿈도 절대 포함해서는 안 됩니다.**
    JSON 객체는 스트림의 마지막에 완전한 형태로 제공되어야 하며, 유효한 JSON 형식이어야 합니다.
    모든 문자열 값 내부에서 줄바꿈이 필요한 경우 반드시 \\n 문자를 사용해야 하며, 문자열 내부에 사용되는 모든 따옴표는 \\"와 같이 이스케이프 처리되어야 합니다.
    요청된 모든 필드(summary, skills, strengths, improvementSuggestions, suggestedResumeMarkdown)는 반드시 JSON 객체 내에 포함되어야 합니다.
  `;

  if (
    refinementDetails &&
    refinementDetails.section &&
    refinementDetails.userInput
  ) {
    // 개선 요청이 있을 경우의 프롬프트
    console.log(
      `[VertexAIHandler] 개선 요청 감지: Section: ${refinementDetails.section}, Input: ${refinementDetails.userInput}`
    );
    prompt = `당신은 최고의 커리어 컨설턴트이자 이력서 개선 전문가입니다. 다음은 사용자의 원본 이력서, 채용 공고(있을 경우), 그리고 특정 섹션에 대한 사용자의 개선 요청입니다.

주어진 정보를 바탕으로, 사용자의 개선 요청을 최우선으로 반영하여 전체 이력서 분석 결과를 JSON 형식으로 다시 생성해주세요.
특히, 사용자가 개선을 요청한 "${refinementDetails.section}" 섹션의 내용을 사용자의 구체적인 요청사항 ("${refinementDetails.userInput}")에 맞춰 수정하고 발전시켜야 합니다.
다른 섹션들(summary, skills, strengths, improvementSuggestions, suggestedResumeMarkdown의 다른 부분)도 이 개선 요청의 맥락에 맞게 필요하다면 함께 업데이트될 수 있습니다.
최종 목표는 사용자의 개선 요청을 만족시키면서 채용 공고에 더욱 최적화된, 완성도 높은 이력서 분석 결과를 제공하는 것입니다.

1. 원본 이력서 내용:
\`\`\`
${resumeText}
\`\`\`

${jobPostingText && jobPostingText.trim() !== ""
      ? `2. 채용공고 내용:\n\`\`\`\n${jobPostingText}\n\`\`\``
      : "2. 채용공고 내용: 제공되지 않음."}

3. 사용자 개선 요청:
   - 대상 섹션: "${refinementDetails.section}"
   - 요청 내용: "${refinementDetails.userInput}"

${commonOutputInstruction}
출력 형식은 이전과 동일하게 summary, skills, strengths, improvementSuggestions, suggestedResumeMarkdown 필드를 포함해야 합니다.
예시 JSON 구조:
\`\`\`json
{
  "summary": "개선 요청이 반영된 새로운 경력 요약입니다.",
  "skills": ["업데이트된 기술1", "기술2"],
  "strengths": ["개선된 강점1", "강점2"],
  "improvementSuggestions": ["사용자 요청에 따른 새로운 개선 제안입니다.", "추가 제안2"],
  "suggestedResumeMarkdown": "# 개선된 이력서 제목\\n\\n## 개선된 한 줄 자기소개\\n${refinementDetails.userInput}을(를) 반영하여 수정된 내용입니다.\\n\\n(이하 전체 이력서 마크다운 내용...)"
}
\`\`\`
`;
  } else {
    // refinementDetails가 없을 경우, 기존 프롬프트 생성 로직 수행
    const isRefineRequest =
      resumeText.includes("[사용자 추가 요청/피드백]:") &&
      resumeText.includes("[이전 AI 분석 결과]:");

    if (isRefineRequest) {
      prompt = `당신은 최고의 커리어 컨설턴트이자 이력서 개선 전문가입니다. 사용자가 제공한 "원본 이력서 내용", AI의 "이전 AI 분석 결과", 그리고 사용자의 "추가 요청/피드백"을 모두 면밀히 검토해주세요. 또한, 제공된 "채용공고 내용"(있을 경우)을 참고하여 이력서를 해당 공고에 최적화해야 합니다.

    사용자의 피드백을 최우선으로 고려하여, 이전 AI 분석 결과(요약, 기술, 강점, 개선 제안)를 바탕으로 더욱 발전되고 구체적인 최종 JSON 결과를 생성해주세요.
    
    최종 JSON 결과는 다음 항목을 반드시 포함해야 합니다:
    1.  "summary": 사용자의 피드백과 채용공고를 반영하여 업데이트된 간결한 경력 요약.
    2.  "skills": 업데이트된 주요 기술 스택 (문자열 배열).
    3.  "strengths": 업데이트된 주요 강점 (문자열 배열).
    4.  "improvementSuggestions": 사용자의 피드백을 반영하고 채용공고의 요구사항에 맞춰 더욱 구체적이고 실행 가능하도록 업데이트된 이력서 개선 제안 사항들 (문자열 배열).
    5.  "suggestedResumeMarkdown": 사용자의 피드백과 채용공고를 바탕으로, 원본 이력서 내용을 수정하고 보완하여 이 공고에 가장 적합한 형태로 재작성한 전체 이력서 내용을 마크다운 형식의 단일 문자열로 제공해주세요. 마크다운 내용에는 제목, 한 줄 자기소개, 지원동기, 주요 역량, AI 도구 활용 사례, 경력 사항, 프로젝트 경험, 기술 스택, 우대사항/기타, 자기소개/커버레터(요약) 등의 섹션을 포함하여 작성해주세요. "이 공고에 적합한 인재로 선발되기 위한 이력서 내용"을 중심으로 작성해야 합니다.

    ${commonOutputInstruction}
    출력 형식 예시 (내용은 실제 분석 결과에 따라 달라집니다):
    \`\`\`json
    {
      "summary": "사용자 피드백과 채용 공고를 반영하여 업데이트된 경력 요약입니다. 이전 분석보다 개선되었습니다.",
      "skills": ["Kotlin", "SpringBoot", "AWS", "MSA"],
      "strengths": ["문제 해결 능력 강화", "리더십 경험 추가", "데이터 기반 의사결정 능력 부각"],
      "improvementSuggestions": ["프로젝트 성과를 구체적인 수치로 표현하는 것이 좋습니다.", "새로운 기술 스택 학습 경험을 추가하여 성장 가능성을 어필하세요."],
      "suggestedResumeMarkdown": "# 지원자 이력서\\n\\n---\\n\\n## 한 줄 자기소개\\n새로운 도전을 통해 성장하는 개발자입니다.\\n\\n## 지원동기\\n귀사의 비전에 공감하며 함께 성장하고 싶습니다.\\n\\n(이하 전체 이력서 마크다운 내용... 모든 줄바꿈은 \\n으로 처리)"
    }
    \`\`\`

    입력 내용 (사용자 피드백, 이전 분석 결과, 원본 이력서가 resumeText에 포함됨):
    \`\`\`
    ${resumeText} 
    \`\`\`

    ${jobPostingText && jobPostingText.trim() !== ""
      ? `
    채용공고 내용:
    \`\`\`
    ${jobPostingText}
    \`\`\`
    `
      : ""}
    `;
    } else if (jobPostingText && jobPostingText.trim() !== "") {
      prompt = `당신은 최고의 커리어 컨설턴트이자 이력서 분석 전문가입니다. 제공된 이력서 내용과 채용공고 내용을 면밀히 비교 분석해주세요.

    분석 결과는 다음 항목을 포함하는 JSON 형식으로 정리해야 합니다:
    1.  "summary": 이력서 내용 기반의 간결한 경력 요약 (3-4 문장).
    2.  "skills": 이력서에서 언급된 주요 기술 스택 (문자열 배열).
    3.  "strengths": 이력서에서 드러나는 주요 강점 (문자열 배열).
    4.  "improvementSuggestions": 채용공고의 요구사항과 이력서 내용을 비교하여, 이력서가 채용공고에 더 부합하도록 만들 수 있는 구체적인 개선 제안 사항들 (문자열 배열).
    5.  "suggestedResumeMarkdown": 채용공고 내용을 바탕으로, 원본 이력서 내용을 수정하고 보완하여 이 공고에 가장 적합한 형태로 재작성한 전체 이력서 내용을 마크다운 형식의 단일 문자열로 제공해주세요. 제목, 한 줄 자기소개, 지원동기, 주요 역량, AI 도구 활용 사례, 경력 사항, 프로젝트 경험, 기술 스택, 우대사항/기타, 자기소개/커버레터(요약) 등의 섹션을 포함하여 작성해주세요. "이 공고에 적합한 인재로 선발되기 위한 이력서 내용"을 중심으로 작성해야 합니다.

    이력서나 채용공고에 명시적으로 언급되지 않은 내용은 추측하여 포함하지 마세요. 모든 내용은 제공된 텍스트에 기반해야 합니다.
    ${commonOutputInstruction}
    출력 형식 예시 (내용은 실제 분석 결과에 따라 달라집니다):
    \`\`\`json
    {
      "summary": "A항목의 B업무를 5년간 수행하며 C와 D 역량을 키웠습니다. E 프로젝트를 성공적으로 이끌었고, F 기술 스택에 능숙합니다.",
      "skills": ["JavaScript", "React", "Node.js", "데이터 분석"],
      "strengths": ["문제 해결 능력", "협업 능력", "빠른 학습 능력"],
      "improvementSuggestions": [
        "채용공고에서 '데이터 기반 의사결정 능력'을 강조하고 있으니, 이력서의 'X 프로젝트' 경험 설명 시 어떤 데이터를 활용하여 어떤 성과를 도출했는지 구체적인 수치를 포함하여 보강하는 것이 좋겠습니다.",
        "채용공고의 주요 업무가 'Y 시스템 개발'이므로, 이력서의 'Z 기술' 활용 경험을 Y 시스템 개발 관점에서 어떻게 기여할 수 있는지 연결하여 설명하면 더욱 효과적일 것입니다."
      ],
      "suggestedResumeMarkdown": "# 지원자 이력서\\n\\n---\\n\\n## 한 줄 자기소개\\nReact와 Node.js를 활용한 풀스택 개발 경험이 있습니다.\\n\\n(이하 전체 이력서 마크다운 내용... 모든 줄바꿈은 \\n으로 처리)"
    }
    \`\`\`

    이력서 내용:
    \`\`\`
    ${resumeText}
    \`\`\`

    채용공고 내용:
    \`\`\`
    ${jobPostingText}
    \`\`\`
    `;
    } else {
      prompt = `당신은 전문 이력서 분석가입니다. 다음 이력서 내용을 분석하여 주요 경력 요약, 핵심 기술 스택, 그리고 강점들을 JSON 형식으로 정리해주세요. 각 항목은 배열 또는 문자열로 적절히 표현해주세요. 이력서에 없는 내용은 포함하지 마세요.
    "suggestedResumeMarkdown" 필드에는 분석된 내용을 바탕으로 생성한 전체 이력서 내용을 마크다운 형식의 단일 문자열로 제공해주세요.
    ${commonOutputInstruction}
    출력 형식 예시 (내용은 실제 분석 결과에 따라 달라집니다):
    \`\`\`json
    {
      "summary": "간결한 경력 요약입니다. 주요 성과와 경험을 포함합니다.",
      "skills": ["기술 스택 1", "기술 스택 2", "자바"],
      "strengths": ["뛰어난 문제 해결 능력", "효율적인 커뮤니케이션", "강한 책임감"],
      "improvementSuggestions": ["프로젝트 경험을 더 구체적인 수치와 함께 제시하는 것이 좋습니다.", "최신 기술 트렌드에 대한 학습 의지를 보여주는 내용을 추가해보세요."],
      "suggestedResumeMarkdown": "# 지원자 이력서\\n\\n## 주요 경력\\n- ...\\n- ...\\n\\n(이하 전체 이력서 마크다운 내용... 모든 줄바꿈은 \\n으로 처리)"
    }
    \`\`\`

    이력서 내용:
    \`\`\`
    ${resumeText}
    \`\`\`
    `;
    }
  }

  let streamResult;
  try {
    console.log(`Vertex AI(@google/genai)에 스트리밍 요청 전송 중 (모델: ${modelId})...`);
    const generationConfigParams = {
      temperature: 0.1, // 일관성을 위해 temperature 값을 낮춤
      // maxOutputTokens: 8192, // 사용자 요청으로 제거
      candidateCount: 1
    };
    const safetySettingsParams = [
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ];

    streamResult = await genAIInstance.models.generateContentStream({
      model: modelId,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        ...generationConfigParams,
        safetySettings: safetySettingsParams,
        abortSignal: abortSignal
      }
    });

    console.log("Vertex AI(@google/genai)로부터 스트림 객체 받음. 호출자에게 반환합니다.");
    return streamResult;
  } catch (error) {
    console.error("analyzeResumeWithVertexAIStream 함수 내 최종 오류 처리:", error);
    const errorMessage = error.message || "알 수 없는 오류";
    throw new Error(
      `Vertex AI(@google/genai) API 스트리밍 처리 중 오류가 발생했습니다: ${errorMessage}`
    );
  }
}

module.exports = { analyzeResumeWithVertexAIStream };
