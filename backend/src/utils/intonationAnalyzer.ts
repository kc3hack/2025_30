import PitchFinder from 'pitchfinder';

interface PitchSegment {
  pitch: number;
  intensity: number;
}

/**
 * 音声バッファを分析して、関西弁のイントネーションにどの程度一致するかを推定します。
 * 
 * この実装では、関西弁の以下の特徴を分析します：
 * 1. 関西弁特有の高低パターン
 * 2. フレーズ末尾のピッチ変動
 * 3. 全体的なピッチ範囲と変動
 * 
 * @param audioBuffer 録音された音声データ（Buffer形式）
 * @returns 関西弁のイントネーション度合いを0-100の数値で返します
 */
export function measureKansaiIntonation(audioBuffer: Buffer): number {
  try {
    console.log('イントネーション分析開始:', {
      bufferLength: audioBuffer.length,
      firstBytes: Array.from(audioBuffer.slice(0, 10)),
      isBuffer: Buffer.isBuffer(audioBuffer)
    });

    // バッファーがWebMフォーマットの場合、ヘッダーをスキップしてPCMデータを取得
    let offset = 0;
    // WebMヘッダーの検出（簡易的な実装）
    if (audioBuffer[0] === 0x1A && audioBuffer[1] === 0x45 && audioBuffer[2] === 0xDF && audioBuffer[3] === 0xA3) {
      console.log('WebMヘッダーを検出、オフセットを調整');
      // ヘッダーをスキップして実際のオーディオデータまでジャンプ
      offset = 4000;
    }

    // オーディオバッファをFloat32Arrayに変換
    const sampleCount = Math.floor((audioBuffer.length - offset) / 2);
    const samples = new Float32Array(sampleCount);
    
    console.log('音声データ処理:', {
      totalLength: audioBuffer.length,
      offset,
      sampleCount,
      processingRange: `${offset} から ${offset + sampleCount * 2}`
    });

    for (let i = 0; i < sampleCount; i++) {
      // オフセットを考慮してデータを読み取り
      samples[i] = audioBuffer.readInt16LE(offset + i * 2) / 32768;
    }

    console.log('サンプルデータに変換:', {
      sampleCount,
      firstSamples: Array.from(samples.slice(0, 5)),
      hasValidData: samples.some(s => s !== 0)
    });

    const sampleRate = 44100;  // サンプリングレート
    const windowSize = 2048;   // 分析ウィンドウサイズ
    const detectPitch = PitchFinder.YIN({ sampleRate });

    // ピッチと音量の値を抽出
    const segments: PitchSegment[] = [];
    let validPitchCount = 0;

    for (let i = 0; i < samples.length; i += windowSize) {
      const segment = samples.subarray(i, i + windowSize);
      const pitch = detectPitch(segment);
      
      if (pitch) {
        validPitchCount++;
        const intensity = Math.sqrt(segment.reduce((sum, sample) => sum + sample * sample, 0) / windowSize);
        segments.push({ pitch, intensity });
      }
    }

    console.log('ピッチ検出結果:', {
      totalWindows: Math.floor(samples.length / windowSize),
      validPitchCount,
      validPitchPercentage: (validPitchCount / Math.floor(samples.length / windowSize)) * 100,
      firstPitchValues: segments.slice(0, 3).map(s => s.pitch)
    });

    if (segments.length === 0) {
      console.log('有効なピッチセグメントが見つかりません');
      return 0;
    }

    // 各種スコアを計算
    const phraseFinalScore = analyzePhraseFinalPatterns(segments);
    const pitchRangeScore = analyzePitchRange(segments);
    const accentPatternScore = analyzeAccentPatterns(segments);

    console.log('スコア構成要素:', {
      phraseFinalScore,
      pitchRangeScore,
      accentPatternScore
    });

    // 異なる重みでスコアを組み合わせる
    const totalScore = (
      phraseFinalScore * 0.4 +    // フレーズ末尾のパターンは関西弁で特に重要
      pitchRangeScore * 0.3 +     // 全体的なピッチ範囲は中程度の重要性
      accentPatternScore * 0.3    // アクセントパターンも中程度の重要性
    );

    const finalScore = Math.round(Math.max(0, Math.min(100, totalScore)));
    console.log('最終イントネーションスコア:', finalScore);

    return finalScore;
  } catch (error) {
    console.error('イントネーション分析でエラー:', error);
    return 0;
  }
}

function analyzePhraseFinalPatterns(segments: PitchSegment[]): number {
  // 発話の最後の20%を分析
  const lastSegmentStart = Math.floor(segments.length * 0.8);
  const lastSegment = segments.slice(lastSegmentStart);

  // 最後の部分のピッチ変動を計算
  const pitchValues = lastSegment.map(s => s.pitch);
  const pitchDelta = calculatePitchMovement(pitchValues);

  // 関西弁は末尾でピッチが上がるか維持されることが多い
  // ピッチが上がる場合や維持される場合は高いスコアを与える
  if (pitchDelta > 0) {
    return 80 + Math.min(20, pitchDelta * 2);
  } else if (pitchDelta > -10) {
    return 70;
  } else {
    return Math.max(0, 60 + pitchDelta);
  }
}

function analyzePitchRange(segments: PitchSegment[]): number {
  const pitches = segments.map(s => s.pitch);
  const max = Math.max(...pitches);
  const min = Math.min(...pitches);
  const range = max - min;

  // 関西弁は通常、ピッチの範囲が広い
  // 範囲が広いほど高いスコアを与える
  return Math.min(100, (range / 100) * 80);
}

function analyzeAccentPatterns(segments: PitchSegment[]): number {
  // 音の強さの変化によってフレーズを区切る
  const phrases = splitIntoPhrases(segments);
  
  let totalScore = 0;
  phrases.forEach(phrase => {
    // 特徴的な高低パターンを探す
    const hasKansaiPattern = detectKansaiAccentPattern(phrase);
    totalScore += hasKansaiPattern ? 100 : 50;
  });

  return totalScore / phrases.length;
}

function calculatePitchMovement(pitches: number[]): number {
  if (pitches.length < 2) return 0;
  const first = pitches.slice(0, Math.floor(pitches.length / 2));
  const last = pitches.slice(-Math.floor(pitches.length / 2));
  return (average(last) - average(first)) / average(first) * 100;
}

function average(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function splitIntoPhrases(segments: PitchSegment[]): PitchSegment[][] {
  const phrases: PitchSegment[][] = [];
  let currentPhrase: PitchSegment[] = [];
  const avgIntensity = average(segments.map(s => s.intensity));

  segments.forEach((segment, i) => {
    currentPhrase.push(segment);
    if (segment.intensity < avgIntensity * 0.7 || i === segments.length - 1) {
      if (currentPhrase.length > 0) {
        phrases.push(currentPhrase);
        currentPhrase = [];
      }
    }
  });

  return phrases;
}

function detectKansaiAccentPattern(phrase: PitchSegment[]): boolean {
  if (phrase.length < 3) return false;

  const pitches = phrase.map(s => s.pitch);
  const firstThird = average(pitches.slice(0, Math.floor(phrase.length / 3)));
  const lastThird = average(pitches.slice(-Math.floor(phrase.length / 3)));

  // 関西弁はフレーズの始まりか終わりでピッチが高くなることが多い
  return firstThird > average(pitches) * 1.1 || lastThird > average(pitches) * 1.1;
}
