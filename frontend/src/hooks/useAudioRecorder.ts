import { useState, useRef, useCallback, useEffect } from 'react';

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [waveformData, setWaveformData] = useState<number[][]>([]);  // 波形データを2次元配列に変更
  const waveformBufferRef = useRef<number[][]>([]);  // 波形データのバッファ
  const lastUpdateTimeRef = useRef<number>(0);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const animationFrame = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      // AudioContext の状態をログ出力
      console.log('AudioContext initial state:', {
        exists: !!audioContext.current,
        state: audioContext.current?.state
      });

      // AudioContext の再利用または新規作成
      if (!audioContext.current || audioContext.current.state === 'closed') {
        audioContext.current = new AudioContext();
        console.log('Created new AudioContext');
      } else if (audioContext.current.state === 'suspended') {
        await audioContext.current.resume();
        console.log('Resumed existing AudioContext');
      }

      console.log('AudioContext after initialization:', {
        state: audioContext.current.state,
        sampleRate: audioContext.current.sampleRate
      });

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      console.log('Audio stream created:', {
        tracks: stream.getAudioTracks().length,
        trackSettings: stream.getAudioTracks()[0].getSettings()
      });

      const source = audioContext.current.createMediaStreamSource(stream);
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 1024; // パフォーマンスを考慮して調整
      analyser.current.smoothingTimeConstant = 0.5; // より滑らかな波形に
      source.connect(analyser.current);

      // 録音開始時に波形データをクリア
      setWaveformData([]);
      waveformBufferRef.current = [];

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
        setAudioData(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      // 波形データの更新関数を最適化
      let isUpdating = true;
      const updateWaveform = () => {
        if (!analyser.current || !isUpdating) return;

        try {
          const currentTime = Date.now();
          // 更新頻度を30fpsに調整（約33ms間隔）
          if (currentTime - lastUpdateTimeRef.current < 33) {
            animationFrame.current = requestAnimationFrame(updateWaveform);
            return;
          }
          lastUpdateTimeRef.current = currentTime;

          const bufferLength = analyser.current.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyser.current.getByteTimeDomainData(dataArray);

          // サンプル数を最適化（画面の幅に対して適切な数に）
          const samplesPerFrame = 50; // フレームあたりのサンプル数
          const skipFactor = Math.max(1, Math.floor(bufferLength / samplesPerFrame));
          const reducedData = [];

          for (let i = 0; i < bufferLength; i += skipFactor) {
            const normalizedValue = (dataArray[i] / 128.0) - 1;
            reducedData.push(normalizedValue);
          }

          // 常にデータを追加
          waveformBufferRef.current.push(reducedData);
          
          // 録音時間に応じてデータを調整（最大60秒分）
          const maxFrames = 30 * 60; // 30fps × 60秒
          if (waveformBufferRef.current.length > maxFrames) {
            // 古いデータを間引く（2フレームごとに1フレーム保持）
            waveformBufferRef.current = waveformBufferRef.current
              .filter((_, index) => index % 2 === 0)
              .slice(-maxFrames);
          }

          setWaveformData([...waveformBufferRef.current]);

        } catch (error) {
          console.error('Error updating waveform:', error);
          isUpdating = false;
          return;
        }

        if (isUpdating) {
          animationFrame.current = requestAnimationFrame(updateWaveform);
        }
      };

      recorder.start(100);
      mediaRecorder.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);

      // アニメーションフレームの管理
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
      isUpdating = true;
      updateWaveform();

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      
      // 波形更新の即時停止
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      }
      
      // AudioContextはすぐには閉じない（再利用のため）
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, []);

  const transcribeAudio = async () => {
    if (!audioData) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      const audioFile = new File([audioData], 'audio.webm', {
        type: 'audio/webm;codecs=opus'
      });
      formData.append('audio', audioFile);

      console.log('Sending audio for transcription:', {
        fileName: audioFile.name,
        fileType: audioFile.type,
        fileSize: audioFile.size
      });

      const response = await fetch('http://localhost:3001/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || `HTTP error! status: ${response.status}`);
      }

      if (!data.text && !data.error) {
        throw new Error('No transcription data received from server');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      console.log('Transcription response:', data);
      setTranscribedText(data.text);
    } catch (error) {
      console.error('Transcription error:', error);
      // エラーメッセージをユーザーに表示するための状態を追加
      setTranscribedText(null);
      throw error; // エラーを上位コンポーネントで処理できるように再スロー
    } finally {
      setIsProcessing(false);
    }
  };

  // クリーンアップ用のエフェクトを追加
  useEffect(() => {
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
      if (audioContext.current) {
        audioContext.current.close();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    audioData,
    audioUrl,
    recordingTime,
    transcribeAudio,
    transcribedText,
    isProcessing,
    waveformData,
  };
};