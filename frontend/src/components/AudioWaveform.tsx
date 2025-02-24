import React, { useEffect, useRef, useState } from 'react';

interface AudioWaveformProps {
  audioData: number[][] | null;
  isRecording: boolean;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ audioData, isRecording }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !audioData?.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // キャンバスの幅を波形データに合わせて調整
    const minWidth = container.clientWidth;
    const dataWidth = Math.max(minWidth, audioData.length * 4); // 1フレームあたり4ピクセル
    canvas.width = dataWidth;

    const draw = () => {
      // キャンバスをクリア
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerY = canvas.height / 2;
      
      // 中央線の描画
      ctx.beginPath();
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.moveTo(0, centerY);
      ctx.lineTo(canvas.width, centerY);
      ctx.stroke();

      if (!audioData?.length) return;

      // フレームごとの幅を計算
      const frameWidth = 4; // 固定幅で描画
      
      // 波形の描画
      ctx.beginPath();
      ctx.strokeStyle = isRecording ? '#ef4444' : '#6b7280';
      ctx.lineWidth = 2;

      audioData.forEach((frame, frameIndex) => {
        const startX = frameIndex * frameWidth;
        
        // 表示範囲外のフレームはスキップ
        if (startX < scrollPosition - frameWidth || startX > scrollPosition + container.clientWidth + frameWidth) {
          return;
        }

        // 各フレームの波形データを描画
        const points: [number, number][] = frame.map((amplitude, i) => {
          const x = startX + (i * (frameWidth / frame.length));
          const y = centerY + (amplitude * centerY * 0.95);
          return [x, y];
        });

        // スムーズな波形を描画
        ctx.beginPath();
        points.forEach((point, i) => {
          if (i === 0) {
            ctx.moveTo(point[0], point[1]);
          } else {
            // 制御点を使用してベジェ曲線を描画
            const prevPoint = points[i - 1];
            const cpX = (point[0] + prevPoint[0]) / 2;
            ctx.quadraticCurveTo(cpX, prevPoint[1], point[0], point[1]);
          }
        });
        ctx.stroke();
      });

      // 録音中のインジケータを描画
      if (isRecording) {
        const gradient = ctx.createLinearGradient(canvas.width - 50, 0, canvas.width, 0);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.2)');
        ctx.fillStyle = gradient;
        ctx.fillRect(canvas.width - 50, 0, 50, canvas.height);
      }
    };

    draw();

    // 録音中は自動スクロール
    if (isRecording && audioData.length > 0) {
      const maxScroll = canvas.width - container.clientWidth;
      setScrollPosition(Math.max(0, maxScroll));
      container.scrollLeft = maxScroll;
    }

    // スクロールイベントの処理
    const handleScroll = () => {
      if (container) {
        setScrollPosition(container.scrollLeft);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [audioData, isRecording]);

  return (
    <div className="relative w-full">
      <div 
        ref={containerRef}
        className="w-full h-[100px] overflow-x-auto rounded-lg bg-gray-100"
        style={{ scrollBehavior: 'smooth' }}
      >
        <canvas
          ref={canvasRef}
          height={100}
          className="h-full"
        />
      </div>
    </div>
  );
};