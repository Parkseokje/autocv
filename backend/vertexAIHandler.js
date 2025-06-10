require("dotenv").config(); // .env 파일 로드

const { GoogleGenAI } = require("@google/genai"); // 클래스 이름 수정: GoogleGenerativeAI -> GoogleGenAI
// Vertex AI 클라이언트 초기화 설정
const projectId = process.env.GCP_PROJECT_ID;
const location = process.env.GCP_LOCATION;
const modelId =
  process.env.VERTEX_AI_MODEL_ID || "gemini-2.5-pro-preview-05-06"; // 사용자 요청 및 파일 내용 반영

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

// 스트리밍 지원을 위해 함수를 제너레이터 함수로 변경하거나, 콜백 또는 EventEmitter를 사용할 수 있습니다.
// 여기서는 SDK의 generateContentStream을 활용하고, 그 결과를 직접 반환하여 호출 측에서 처리하도록 합니다.
async function analyzeResumeWithVertexAIStream(
  resumeText,
  jobPostingText = ""
) {
  // jobPostingText 인자 추가
  if (!genAIInstance) {
    throw new Error(
      "GoogleGenAI 인스턴스가 초기화되지 않았습니다. 서버 시작 시 로그에서 초기화 오류를 확인하세요."
    );
  }
  if (!resumeText || resumeText.trim() === "") {
    throw new Error("이력서 텍스트는 비어 있을 수 없습니다.");
  }

  let prompt;

  // resumeText가 "[원본 이력서 내용]:", "[이전 AI 분석 결과]:", "[사용자 추가 요청/피드백]:" 패턴을 포함하는지 확인하여 refine 요청인지 구분
  const isRefineRequest =
    resumeText.includes("[사용자 추가 요청/피드백]:") &&
    resumeText.includes("[이전 AI 분석 결과]:");

  if (isRefineRequest) {
    // 양방향 최적화 요청 (refine)
    // resumeText는 combinedTextForRefinement (원본 이력서, 이전 분석, 사용자 피드백 포함)
    // jobPostingText는 채용공고 내용 (있을 경우)
    prompt = `당신은 최고의 커리어 컨설턴트이자 이력서 개선 전문가입니다. 사용자가 제공한 "원본 이력서 내용", AI의 "이전 AI 분석 결과", 그리고 사용자의 "추가 요청/피드백"을 모두 면밀히 검토해주세요. 또한, 제공된 "채용공고 내용"(있을 경우)을 참고하여 이력서를 해당 공고에 최적화해야 합니다.

    사용자의 피드백을 최우선으로 고려하여, 이전 AI 분석 결과(요약, 기술, 강점, 개선 제안)를 바탕으로 더욱 발전되고 구체적인 최종 JSON 결과를 생성해주세요.
    
    최종 JSON 결과는 다음 항목을 반드시 포함해야 합니다:
    1.  "summary": 사용자의 피드백과 채용공고를 반영하여 업데이트된 간결한 경력 요약.
    2.  "skills": 업데이트된 주요 기술 스택 (배열).
    3.  "strengths": 업데이트된 주요 강점 (배열).
    4.  "improvementSuggestions": 사용자의 피드백을 반영하고 채용공고의 요구사항에 맞춰 더욱 구체적이고 실행 가능하도록 업데이트된 이력서 개선 제안 사항들 (배열).
    5.  "suggestedResumeMarkdown": **사용자의 피드백과 채용공고를 바탕으로, 원본 이력서 내용을 수정하고 보완하여 이 공고에 가장 적합한 형태로 재작성한 전체 이력서 내용을 마크다운 형식의 문자열로 제공해주세요. 사용자가 제공한 예시 마크다운 형식을 참고하여, 제목, 한 줄 자기소개, 지원동기, 주요 역량, AI 도구 활용 사례, 경력 사항, 프로젝트 경험, 기술 스택, 우대사항/기타, 자기소개/커버레터(요약) 등의 섹션을 포함하여 작성해주세요. "이 공고에 적합한 인재로 선발되기 위한 이력서 내용"을 중심으로 작성해야 합니다. 생성되는 마크다운 내용은 자연스러운 띄어쓰기를 사용하여 가독성을 높여주세요.**

    모든 내용은 제공된 텍스트에 기반해야 하며, 사용자의 피드백을 적극적으로 반영하여 이전 분석보다 개선된 결과를 제공해야 합니다.

    출력 형식 예시:
    \`\`\`json
    {
      "summary": "...",
      "skills": ["...", "..."],
      "strengths": ["...", "..."],
      "improvementSuggestions": ["...", "..."],
      "suggestedResumeMarkdown": "# 박석제 이력서\n\n---\n\n## 한 줄 자기소개\n..."
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
    // 초기 분석 요청 + 채용공고 있는 경우
    prompt = `당신은 최고의 커리어 컨설턴트이자 이력서 분석 전문가입니다. 제공된 이력서 내용과 채용공고 내용을 면밀히 비교 분석해주세요.

    분석 결과는 다음 항목을 포함하는 JSON 형식으로 정리해야 합니다:
    1.  "summary": 이력서 내용 기반의 간결한 경력 요약 (3-4 문장).
    2.  "skills": 이력서에서 언급된 주요 기술 스택 (배열).
    3.  "strengths": 이력서에서 드러나는 주요 강점 (배열).
    4.  "improvementSuggestions": 채용공고의 요구사항과 이력서 내용을 비교하여, 이력서가 채용공고에 더 부합하도록 만들 수 있는 구체적인 개선 제안 사항들 (배열).
    5.  "suggestedResumeMarkdown": **채용공고 내용을 바탕으로, 원본 이력서 내용을 수정하고 보완하여 이 공고에 가장 적합한 형태로 재작성한 전체 이력서 내용을 마크다운 형식의 문자열로 제공해주세요. 사용자가 제공한 예시 마크다운 형식을 참고하여, 제목, 한 줄 자기소개, 지원동기, 주요 역량, AI 도구 활용 사례, 경력 사항, 프로젝트 경험, 기술 스택, 우대사항/기타, 자기소개/커버레터(요약) 등의 섹션을 포함하여 작성해주세요. "이 공고에 적합한 인재로 선발되기 위한 이력서 내용"을 중심으로 작성해야 합니다. 생성되는 마크다운 내용은 자연스러운 띄어쓰기를 사용하여 가독성을 높여주세요.**

    이력서나 채용공고에 명시적으로 언급되지 않은 내용은 추측하여 포함하지 마세요. 모든 내용은 제공된 텍스트에 기반해야 합니다.

    출력 형식 예시:
    \`\`\`json
    {
      "summary": "A항목의 B업무를 5년간 수행하며 C와 D 역량을 키웠습니다. E 프로젝트를 성공적으로 이끌었고, F 기술 스택에 능숙합니다.",
      "skills": ["JavaScript", "React", "Node.js", "데이터 분석"],
      "strengths": ["문제 해결 능력", "협업 능력", "빠른 학습 능력"],
      "improvementSuggestions": [
        "채용공고에서 '데이터 기반 의사결정 능력'을 강조하고 있으니, 이력서의 'X 프로젝트' 경험 설명 시 어떤 데이터를 활용하여 어떤 성과를 도출했는지 구체적인 수치를 포함하여 보강하는 것이 좋겠습니다.",
        "채용공고의 주요 업무가 'Y 시스템 개발'이므로, 이력서의 'Z 기술' 활용 경험을 Y 시스템 개발 관점에서 어떻게 기여할 수 있는지 연결하여 설명하면 더욱 효과적일 것입니다. 예를 들어, 'Z 기술을 활용하여 Y 시스템의 성능을 20% 개선한 경험이 있습니다.'와 같이 구체적으로 작성하는 것을 고려해보세요."
      ],
      "suggestedResumeMarkdown": "# 박석제 이력서\n\n---\n\n## 한 줄 자기소개\n..."
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
    // 초기 분석 요청 + 채용공고 없는 경우
    prompt = `당신은 전문 이력서 분석가입니다. 다음 이력서 내용을 분석하여 주요 경력 요약, 핵심 기술 스택, 그리고 강점들을 JSON 형식으로 정리해주세요. 각 항목은 배열 또는 문자열로 적절히 표현해주세요. 이력서에 없는 내용은 포함하지 마세요.
  
    출력 형식 예시:
    \`\`\`json
    {
      "summary": "간결한 경력 요약",
      "skills": ["기술1", "기술2", "기술3"],
      "strengths": ["강점1", "강점2", "강점3"],
      "suggestedResumeMarkdown": "# 이력서 제목\n\n---\n\n## 한 줄 자기소개\n...\n(띄어쓰기가 잘 된 마크다운 내용)"
    }
    \`\`\`

    이력서 내용:
    \`\`\`
    ${resumeText}
    \`\`\`
    `;
  }

  let streamResult;
  try {
    console.log(`Vertex AI(@google/genai)에 스트리밍 요청 전송 중 (모델: ${modelId})...`);
    const generationConfig = {
      temperature: 0.3, // 약간의 창의성을 허용하여 더 나은 제안을 유도
      maxOutputTokens: 4096
    };
    const safetySettings = [
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

    // generateContentStream 사용
    streamResult = await genAIInstance.models.generateContentStream({
      model: modelId,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generation_config: generationConfig,
      safety_settings: safetySettings
    });

    // 스트림 자체를 반환하여 호출자가 처리하도록 함
    // 호출자는 for await...of 루프를 사용하여 청크를 받을 수 있음
    console.log("Vertex AI(@google/genai)로부터 스트림 객체 받음. 호출자에게 반환합니다.");
    return streamResult; // ReadableStream<GenerateContentResponse> 또는 유사한 타입 반환
  } catch (error) {
    console.error("analyzeResumeWithVertexAIStream 함수 내 최종 오류 처리:", error);
    const errorMessage = error.message || "알 수 없는 오류";
    throw new Error(
      `Vertex AI(@google/genai) API 스트리밍 처리 중 오류가 발생했습니다: ${errorMessage}`
    );
  }
}

module.exports = { analyzeResumeWithVertexAIStream };
// analyzeResumeWithVertexAI 함수는 analyzeResumeWithVertexAIStream으로 변경되었으므로 export 이름도 변경
