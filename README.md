# 関西人チェッカー
<!-- プロダクト名に変更してください -->

![関西人チェッカー](/frontend/public/image.png)
<!-- プロダクト名・イメージ画像を差し変えてください -->


## チーム名
チーム30 関西弁警察
<!-- チームIDとチーム名を入力してください -->


## 背景・課題・解決されること

<!-- テーマ「関西をいい感じに」に対して、考案するプロダクトがどういった(Why)背景から思いついたのか、どのよう(What)な課題があり、どのよう(How)に解決するのかを入力してください -->
### 背景
- 現在、えせ関西人が多いという現状と、日常で自分の本来の方言への意識の低さが課題となっています。
### 目的
- ユーザーが自分のルーツである関西弁を正しく認識し、真の関西人としての自然な発声を実現するためのツールを提供する。
- 音声録音、文字起こし、音声イントネーションの解析を組み合わせ、関西弁の評価を数値化することで、自己評価を可能にする。


## プロダクト説明

<!-- 開発したプロダクトの説明を入力してください -->
このプロジェクトは、ユーザーが音声録音を通して自分の関西弁を学習・練習し、その正確さや自然さを評価する教育支援ツールです。えせ関西人をあぶり出し、真の関西人を見極めるというユニークな視点で開発しました。

## 操作説明・デモ動画
[デモ動画はこちら](https://docs.google.com/presentation/d/1UHo7ivtnz8pBh9pKncgp1xnGZGnf-EC_-Fv-FdqvXnc/edit?pli=1#slide=id.g339359ff50f_1_54)
<!-- 開発したプロダクトの操作説明について入力してください。また、操作説明デモ動画があれば、埋め込みやリンクを記載してください -->


## 注力したポイント

<!-- 開発したプロダクトの中で、特に注力して作成した箇所・ポイントについて入力してください -->
### アイデア面

あらかじめ用意した標準語テキストと翻訳してもらった関西弁テキストの差異をみて語尾に関西弁あるかみて、関西弁レベルを評価する方法に拘りました。

GPT-4とOpenAI Whisper APIなど先端のAI技術を活用し、関西弁の自然さを数値化する新しい評価方法を考えました。

### デザイン面

ユーザーが直感的に操作できる、シンプルなUIにしました。

### その他

Dockerを用いた環境統一により、開発・デプロイの効率化と再現性の高い運用。

## 使用技術

<!-- 使用技術を入力してください -->
- フロントエンド: Next.js, TypeScript, Tailwind CSS

- バックエンド:  Hono, TypeScript

- 音声認識サービス: OpenAI Whisper, FFmpeg

- インフラ: Docker


<!--
markdownの記法はこちらを参照してください！
https://docs.github.com/ja/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax
-->
