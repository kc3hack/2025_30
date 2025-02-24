import { useState, useRef, useCallback, useEffect } from 'react';

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,         // モノラル録音
          sampleRate: 16000,       // Whisper推奨のサンプルレート
          echoCancellation: true,  // エコーキャンセル有効
          noiseSuppression: true,  // ノイズ抑制有効
          autoGainControl: true    // 自動ゲイン制御有効
        } 
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000 // 128kbpsで録音
      });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
          console.log('Audio chunk received:', {
            chunkSize: e.data.size,
            totalChunks: chunks.length
          });
        }
      };

      recorder.onstop = async () => {
        console.log('Recording stopped, processing chunks:', {
          numberOfChunks: chunks.length,
          totalSize: chunks.reduce((size, chunk) => size + (chunk as Blob).size, 0)
        });

        const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
        setAudioData(blob);
        
        console.log('Created audio blob:', {
          type: blob.type,
          size: blob.size
        });
        
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      recorder.start(100); // 100msごとにデータを取得
      mediaRecorder.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      console.log('Recording started with settings:', {
        sampleRate: 16000,
        channelCount: 1,
        bitRate: 128000
      });
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
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
      // 音声ファイルの名前とMIMEタイプを明示的に指定
      const audioFile = new File([audioData], 'audio.webm', {
        type: 'audio/webm;codecs=opus'
      });
      formData.append('audio', audioFile);

      // 音声データをArrayBufferに変換してローカルストレージに保存
      const arrayBuffer = await audioFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      console.log('Storing audio data:', {
        arrayBufferSize: arrayBuffer.byteLength,
        uint8ArrayLength: uint8Array.length,
        firstBytes: Array.from(uint8Array.slice(0, 10))
      });
      localStorage.setItem('kc3_audio_data', JSON.stringify(Array.from(uint8Array)));

      console.log('Sending audio for transcription:', {
        fileName: audioFile.name,
        fileType: audioFile.type,
        fileSize: audioFile.size
      });

      const response = await fetch('http://localhost:3001/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Transcription response:', data);

      if (data.text) {
        setTranscribedText(data.text);
      } else {
        throw new Error('No transcription received');
      }
    } catch (error) {
      console.error('Transcription error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
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
  };
};