"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { Loading } from "@/components/Loading";

export default function TranscriptionResult() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const transcribedText = searchParams.get("text");
  const standardText = searchParams.get("standard");
  const audioData = useRef<Uint8Array | null>(null);

  const [analysisResult, setAnalysisResult] = useState<{
    kansaiLevel: number;
    intonationScore: number;
    finalScore: number;
    analysis: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const hasAnalyzed = useRef(false);

  useEffect(() => {
    try {
      // ローカルストレージから音声データを取得
      const storedAudioData = localStorage.getItem('kc3_audio_data');
      console.log('Retrieving audio data:', {
        hasStoredData: !!storedAudioData,
        dataLength: storedAudioData ? storedAudioData.length : 0
      });

      if (storedAudioData) {
        const arrayData = JSON.parse(storedAudioData);
        console.log('Parsed audio data:', {
          arrayLength: arrayData.length,
          firstBytes: arrayData.slice(0, 10)
        });

        audioData.current = new Uint8Array(arrayData);
        console.log('Created Uint8Array:', {
          arrayLength: audioData.current.length,
          firstBytes: Array.from(audioData.current.slice(0, 10))
        });

        // 使用後はローカルストレージから削除
        localStorage.removeItem('kc3_audio_data');
      }
    } catch (error) {
      console.error('Error retrieving audio data:', error);
    }
  }, []);

  const analyzeKansaiDialect = useCallback(async () => {
    if (!standardText || !transcribedText || isAnalyzing || hasAnalyzed.current) return;
    
    hasAnalyzed.current = true;
    setIsAnalyzing(true);
    try {
      const audioBuffer = audioData.current;
      console.log('Preparing audio data for analysis:', {
        hasAudioBuffer: !!audioBuffer,
        bufferLength: audioBuffer?.length || 0,
        firstBytes: audioBuffer ? Array.from(audioBuffer.slice(0, 10)) : null
      });

      const requestBody = {
        standardText,
        kansaiText: transcribedText,
        audioBuffer: audioBuffer ? Array.from(audioBuffer) : null
      };

      const response = await fetch("http://localhost:3001/analyze-kansai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Analysis Result:', data);  // 分析結果をコンソールに表示
      setAnalysisResult(data);
    } catch (error) {
      console.error("Failed to analyze Kansai dialect:", error);
      hasAnalyzed.current = false;
    } finally {
      setIsAnalyzing(false);
    }
  }, [standardText, transcribedText, isAnalyzing]);

  useEffect(() => {
    analyzeKansaiDialect();
  }, [analyzeKansaiDialect]);

  return (
    <>
      {isAnalyzing ? (
        <Loading message="分析中..." />
      ) : (
        <main className="min-h-screen w-full max-w-7xl mx-auto px-4 py-8 flex flex-col items-center justify-start gap-8">
          <h1 className="text-4xl md:text-6xl font-normal text-center">
            文字起こし結果
          </h1>
          
          <div className="w-full max-w-2xl bg-white shadow-lg rounded-lg p-6">
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-2">お手本の文章:</h2>
              <p className="text-lg whitespace-pre-wrap p-4 bg-gray-50 rounded-md">
                {standardText || "標準テキストが見つかりません。"}
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-2">あなたの話した内容:</h2>
              <p className="text-lg whitespace-pre-wrap p-4 bg-gray-50 rounded-md">
                {transcribedText || "文字起こしの結果が見つかりません。"}
              </p>
            </div>

            {!isAnalyzing && analysisResult && (
              <div className="mt-8">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold mb-2">総合スコア</h2>
                  <div className="text-7xl font-bold text-blue-600 mb-2">
                    {analysisResult.finalScore}%
                  </div>
                  <div className="h-4 bg-gray-200 rounded-full w-full max-w-md mx-auto">
                    <div 
                      className="h-4 bg-blue-600 rounded-full transition-all duration-500" 
                      style={{ width: `${analysisResult.finalScore}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-2">テキスト分析</h3>
                    <div className="text-4xl font-bold text-green-600 mb-2">
                      {analysisResult.kansaiLevel}%
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full w-full max-w-xs mx-auto">
                      <div 
                        className="h-3 bg-green-600 rounded-full transition-all duration-500" 
                        style={{ width: `${analysisResult.kansaiLevel}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-2">イントネーション</h3>
                    <div className="text-4xl font-bold text-purple-600 mb-2">
                      {analysisResult.intonationScore}%
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full w-full max-w-xs mx-auto">
                      <div 
                        className="h-3 bg-purple-600 rounded-full transition-all duration-500" 
                        style={{ width: `${analysisResult.intonationScore}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-6 mt-4">
                  <h3 className="text-xl font-semibold mb-3">分析結果</h3>
                  <div className="text-gray-700 whitespace-pre-line leading-relaxed text-lg">
                    {analysisResult.analysis.split('\n').map((line, index) => (
                      line.trim() && (
                        <p key={index} className="mb-2">
                          {line.startsWith('・') ? (
                            <span className="block pl-4">{line}</span>
                          ) : (
                            line
                          )}
                        </p>
                      )
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!isAnalyzing && !analysisResult && (
              <div className="text-center p-4">
                <p className="mb-4">分析に失敗しました</p>
                <button
                  onClick={() => {
                    hasAnalyzed.current = false;
                    analyzeKansaiDialect();
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                  再分析
                </button>
              </div>
            )}

          </div>

          <button
            onClick={() => router.back()}
            className="mt-8 px-6 py-3 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            戻る
          </button>
        </main>
      )}
    </>
  );
}