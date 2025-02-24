import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { OpenAI } from 'openai'
import * as fs from 'fs'
import * as path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from '@ffmpeg-installer/ffmpeg'
import * as dotenv from 'dotenv'
import { measureKansaiIntonation } from './utils/intonationAnalyzer'
import * as os from 'os'
import { v4 as uuidv4 } from 'uuid'

// .envファイルを読み込む
dotenv.config()

// APIキーが設定されているか確認
if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY is not set in .env file')
  process.exit(1)
}

ffmpeg.setFfmpegPath(ffmpegPath.path)

const app = new Hono()

// CORSの設定を更新
app.use('/*', cors({
  origin: ['http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400,
}))

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

app.get('/', (c) => {
  return c.json({ message: 'KC3-Project API is running!' })
})

app.post('/transcribe', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      console.error('No audio file in request');
      return c.json({ error: 'No audio file provided' }, 400);
    }

    console.log('Received audio file:', {
      type: audioFile.type,
      size: audioFile.size,
      name: audioFile.name,
      lastModified: audioFile.lastModified
    });

    // 一時ファイルパスの設定
    const tempDir = path.join(__dirname, '../temp');
    console.log('Temp directory:', {
      path: tempDir,
      exists: fs.existsSync(tempDir),
      permissions: fs.statSync(tempDir).mode.toString(8)
    });

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log('Created temp directory');
    }

    const tempId = uuidv4();
    const inputPath = path.join(tempDir, `input-${tempId}.webm`);
    const outputPath = path.join(tempDir, `output-${tempId}.mp3`);

    // 音声ファイルを一時保存
    try {
      const arrayBuffer = await audioFile.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuffer);
      
      console.log('Processing audio file:', {
        bufferSize: inputBuffer.length,
        firstBytes: Array.from(inputBuffer.slice(0, 16)),
        isValidWebM: inputBuffer.slice(0, 4).toString('hex') === '1a45dfa3'
      });
      
      fs.writeFileSync(inputPath, inputBuffer);
      console.log('Saved input file:', {
        path: inputPath,
        size: fs.statSync(inputPath).size,
        exists: fs.existsSync(inputPath)
      });
    } catch (error) {
      console.error('Error saving audio file:', error);
      return c.json({ 
        error: 'Failed to save audio file',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }

    console.log('Converting audio file:', {
      inputPath,
      outputPath,
      inputSize: fs.statSync(inputPath).size
    });

    // WebMからMP3に変換（Whisper向けに最適化）
    try {
      await new Promise((resolve, reject) => {
        interface FFmpegProgress {
          frames: number;
          currentFps: number;
          currentKbps: number;
          targetSize: number;
          timemark: string;
          percent?: number;
        }

        let progressData: FFmpegProgress = {
          frames: 0,
          currentFps: 0,
          currentKbps: 0,
          targetSize: 0,
          timemark: '00:00:00',
          percent: 0
        };

        ffmpeg(inputPath)
          .toFormat('mp3')
          .audioChannels(1)           // モノラル
          .audioFrequency(16000)      // Whisper推奨のサンプルレート
          .audioBitrate('64k')        // 適度な音質
          .audioQuality(5)            // 品質設定（0-9, 0が最高品質）
          .audioFilters([
            'silenceremove=1:0:-50dB', // 無音部分の除去
            'volume=1.5',              // 音量を少し上げる
            'highpass=200',            // 低周波ノイズの除去
            'lowpass=3000',            // 高周波ノイズの除去
            'dynaudnorm'               // 音量の正規化
          ])
          .save(outputPath)
          .on('start', (command) => {
            console.log('FFmpeg conversion started with command:', command);
          })
          .on('progress', (progress: FFmpegProgress) => {
            progressData = progress;
            if (progress.percent) {
              console.log(`Processing: ${Math.round(progress.percent)}% done`);
            }
          })
          .on('end', () => {
            console.log('Audio conversion completed:', {
              outputSize: fs.statSync(outputPath).size,
              duration: progressData.timemark
            });
            resolve(null);
          })
          .on('error', (err) => {
            console.error('FFmpeg conversion error:', err);
            reject(err);
          });
      });
      console.log('Audio conversion successful');
    } catch (error) {
      console.error('FFmpeg conversion error:', error);
      return c.json({ 
        error: 'Failed to convert audio file',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }

    // 変換後のファイルを確認
    const stats = fs.statSync(outputPath);
    console.log('Converted file stats:', {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    });

    // Whisperで文字起こし
    try {
      console.log('Starting Whisper transcription');
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(outputPath),
        model: 'whisper-1',
        language: 'ja',
        temperature: 0.2,            // より正確な文字起こしのため低めに設定
        response_format: 'json'
      });

      console.log('Transcription result:', {
        success: true,
        hasText: !!transcription.text,
        textLength: transcription.text?.length,
        textPreview: transcription.text?.substring(0, 50)
      });

      // 一時ファイルの削除
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);

      if (!transcription.text) {
        throw new Error('No transcription text received from Whisper API');
      }

      return c.json({ text: transcription.text });
    } catch (error) {
      console.error('Whisper API error:', error);
      return c.json({ 
        error: 'Failed to transcribe audio',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  } catch (error) {
    console.error('Unexpected transcription error:', error);
    return c.json({ 
      error: 'Unexpected error during transcription',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post("/analyze-kansai", async (c) => {
  try {
    const { standardText, kansaiText, audioBuffer } = await c.req.json();

    // デバッグ用のログを追加
    console.log('Received audio buffer:', {
      hasAudioBuffer: !!audioBuffer,
      bufferLength: audioBuffer ? audioBuffer.length : 0,
      sampleValue: audioBuffer ? audioBuffer.slice(0, 5) : null // 最初の5サンプルを表示
    });

    if (!standardText || !kansaiText) {
      return c.json(
        { error: "Both standard and Kansai texts are required" },
        400
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `関西弁の分析を短く簡潔に行ってください。

回答は以下の形式で、2-3行程度でまとめてください：

関西弁レベル: [0-100の数字]
分析: [関西弁の特徴や自然さについて、2-3行で簡潔に説明]`,
        },
        {
          role: "user",
          content: `標準語: "${standardText}"
関西弁: "${kansaiText}"

上記のテキストを比較して、関西弁の特徴を簡潔に分析してください。`,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    if (!completion.choices[0].message.content) {
      return c.json({ error: "Failed to get analysis result" }, 500);
    }

    const response = completion.choices[0].message.content;
    let kansaiLevel = 0;

    // レスポンスから数値を抽出
    const match = response.match(/関西弁レベル:\s*(\d+)/i);
    if (match) {
      kansaiLevel = parseInt(match[1]);
    }

    // 分析部分を抽出（改行を保持）
    const analysisMatch = response.match(/分析:[\s\n]*([\s\S]+?)(?=---|$)/i);
    const analysis = analysisMatch
      ? analysisMatch[1].trim()
      : "分析結果を取得できませんでした。";

    let intonationScore = 0;
    
    if (audioBuffer) {
      try {
        // 一時ファイルのパスを設定
        const tempDir = os.tmpdir();
        const tempId = uuidv4();
        const inputPath = path.join(tempDir, `input-${tempId}.webm`);
        const outputPath = path.join(tempDir, `output-${tempId}.raw`);

        // WebMファイルを一時保存
        fs.writeFileSync(inputPath, Buffer.from(audioBuffer));

        console.log('Converting audio file:', {
          inputPath,
          outputPath
        });

        // WebMからPCM形式に変換
        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .toFormat('s16le')  // 16-bit PCM
            .audioChannels(1)   // モノラル
            .audioFrequency(44100)  // サンプルレート
            .save(outputPath)
            .on('end', resolve)
            .on('error', (err) => {
              console.error('FFmpeg conversion error:', err);
              reject(err);
            });
        });

        // 変換したPCMデータを読み込み
        const rawAudioBuffer = fs.readFileSync(outputPath);
        console.log('Converted audio data:', {
          rawBufferLength: rawAudioBuffer.length,
          firstBytes: Array.from(rawAudioBuffer.slice(0, 10))
        });

        // インントネーション分析を実行
        intonationScore = measureKansaiIntonation(rawAudioBuffer);

        // 一時ファイルを削除
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      } catch (error) {
        console.error('Audio processing error:', error);
      }
    }

    // スコア計算のログを出力
    console.log('=== 関西弁レベル計算過程 ===');
    console.log('テキスト分析スコア:', kansaiLevel);
    console.log('イントネーションスコア:', intonationScore);
    console.log('合計:', kansaiLevel + intonationScore);
    console.log('平均値:', (kansaiLevel + intonationScore) / 2);

    // 最終スコアを計算（テキストの関西弁レベルとイントネーションスコアの平均）
    const finalScore = Math.round((kansaiLevel + intonationScore) / 2);
    console.log('最終スコア（四捨五入後）:', finalScore);
    console.log('========================');

    return c.json({
      kansaiLevel,
      intonationScore,
      finalScore,
      analysis,
      standardText,
      kansaiText,
    });
  } catch (error) {
    console.error('Kansai analysis error:', error)
    return c.json({ error: 'Failed to analyze Kansai dialect' }, 500)
  }
})

const port = Number(process.env.PORT) || 3001
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port: port
})