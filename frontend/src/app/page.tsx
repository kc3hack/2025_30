"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { getRandomStandardText } from '../constants/texts';
import { Loading } from '../components/Loading';
import { AudioWaveform } from '../components/AudioWaveform';

export default function Home() {
  const router = useRouter();
  const [standardText, setStandardText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { 
    isRecording, 
    startRecording, 
    stopRecording, 
    audioData, 
    audioUrl, 
    recordingTime, 
    transcribeAudio, 
    transcribedText, 
    isProcessing: isTranscribing,
    waveformData
  } = useAudioRecorder();

  useEffect(() => {
    setStandardText(getRandomStandardText());
  }, []);

  useEffect(() => {
    if (transcribedText) {
      const url = `/result?text=${encodeURIComponent(transcribedText)}&standard=${encodeURIComponent(standardText)}`;
      router.push(url);
    }
  }, [transcribedText, router, standardText]);

  const handleRecordClick = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleNewText = () => {
    setStandardText(getRandomStandardText());
  };

  const handleTranscribe = async () => {
    try {
      setError(null);
      await transcribeAudio();
    } catch (err) {
      setError(err instanceof Error ? err.message : '音声の文字起こしに失敗しました');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      {isTranscribing && <Loading message="分析中..." />}
      <main className="min-h-screen w-full max-w-7xl mx-auto px-4 py-8 flex flex-col items-center justify-start gap-8 relative">
        <h1 className="text-4xl md:text-6xl font-normal text-center">
          関西人チェッカー
        </h1>
        
        <div className="w-full max-w-2xl bg-[#d9d9d9] rounded-lg p-6 flex flex-col items-center justify-center gap-4">
          <p className="text-2xl md:text-4xl font-normal text-center">
            {standardText}
          </p>
          <button
            onClick={handleNewText}
            className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors text-base md:text-lg"
          >
            別の文章に変更
          </button>
        </div>

        <p className="text-2xl md:text-4xl font-normal text-center mt-8">
          関西弁に翻訳してね
        </p>

        <div className="flex flex-col items-center gap-4 mt-4">
          <div className="text-xl md:text-2xl font-normal text-gray-700 h-8">
            {isRecording && `録音中: ${formatTime(recordingTime)}`}
          </div>
          <button 
            onClick={handleRecordClick}
            className={`w-48 h-48 md:w-64 md:h-64 bg-[#d9d9d9] rounded-full flex items-center justify-center transition-colors 
              ${isRecording ? 'bg-red-400 animate-pulse' : ''} 
              hover:bg-gray-300`}
          >
            <span className="text-3xl md:text-5xl font-normal">録音</span>
          </button>

          {/* 波形表示の追加 */}
          <div className="w-full max-w-2xl mt-4">
            <AudioWaveform
              audioData={waveformData}
              isRecording={isRecording}
            />
          </div>
        </div>

        {error && (
          <div className="w-full max-w-2xl p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <p className="text-center">{error}</p>
          </div>
        )}

        {!isRecording && recordingTime > 0 && (
          <button
            onClick={handleTranscribe}
            disabled={isTranscribing}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-full disabled:opacity-50"
          >
            文字起こしを開始
          </button>
        )}
      </main>
    </div>
  );
}
