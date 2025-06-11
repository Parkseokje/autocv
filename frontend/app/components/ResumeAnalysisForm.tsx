import { Form } from "@remix-run/react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';

interface ResumeAnalysisFormProps {
  isLoading: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export default function ResumeAnalysisForm({ isLoading, onSubmit }: ResumeAnalysisFormProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setUploadedFile(acceptedFiles[0]);
      // Manually set the file to the hidden input for form submission
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(acceptedFiles[0]);
      const fileInput = document.getElementById('resumeFile') as HTMLInputElement;
      if (fileInput) {
        fileInput.files = dataTransfer.files;
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    multiple: false,
  });

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!uploadedFile && !(document.getElementById('resumeFile') as HTMLInputElement)?.files?.length) {
        alert("이력서 파일을 선택해주세요.");
        event.preventDefault(); // Prevent form submission
        return;
    }
    onSubmit(event);
  };


  return (
    <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-8 w-full max-w-2xl">
      <h1 className="text-3xl font-bold text-center text-gray-800 dark:text-gray-100 mb-8">
        AI 이력서 분석 & 생성
      </h1>

      <Form method="post" encType="multipart/form-data" className="space-y-6" onSubmit={handleFormSubmit}>
        <div>
          <label
            // htmlFor="resumeFile" // Dropzone will handle this
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            이력서 파일 업로드 (PDF, DOCX)
          </label>
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer 
                        ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-gray-700' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-gray-50 dark:bg-gray-700/50'}`}
          >
            <input {...getInputProps()} id="resumeFile" name="resumeFile" />
            <DocumentArrowUpIcon className={`w-12 h-12 mb-3 ${isDragActive ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`} />
            {isDragActive ? (
              <p className="text-sm text-blue-600 dark:text-blue-400"><span className="font-semibold">파일을 여기에 놓으세요</span></p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold">클릭하여 파일을 선택</span>하거나 파일을 여기로 드래그하세요
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PDF, DOC, DOCX (최대 5MB)</p>
            {uploadedFile && (
              <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                선택된 파일: {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>
        </div>
        <div>
          <label
            htmlFor="jobPostingUrl"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            채용공고 URL (선택 사항)
          </label>
          <input
            type="url"
            name="jobPostingUrl"
            id="jobPostingUrl"
            className="block w-full text-sm text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500"
            placeholder="https://example.com/job-posting"
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-offset-gray-800 disabled:opacity-50"
          >
            {isLoading ? "분석 중..." : "이력서 분석 및 생성 시작"}
          </button>
        </div>
      </Form>
    </div>
  );
}
