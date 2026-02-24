# nanobanana-image

Gemini API を使ってスライド用の画像を生成する Claude Code スキル。

## セットアップ

### 1. Gemini API キーを取得

[Google AI Studio](https://aistudio.google.com/apikey) からAPIキーを取得する。

### 2. APIキーを設定

`.env.example` をコピーして `.env.local` を作成し、APIキーを記入する：

```bash
cp .env.example .env.local
```

`.env.local` は `.gitignore` に含まれているため、キーがリポジトリにコミットされることはない。

### 3. 依存パッケージをインストール

```bash
npm install --no-save @google/genai
```

`--no-save` により `package.json` は変更されない。

## 使い方

Claude Code で以下のように呼び出す：

```
/nanobanana-image サンプルデッキに未来都市の画像を追加して
```

スキルが自動的にプロンプトを最適化し、画像を生成してMDXファイルに挿入する。

## スクリプト単体での実行

```bash
npx tsx .claude/skills/nanobanana-image/scripts/generate-image.ts \
  --prompt "A futuristic cityscape at sunset, wide angle, cinematic lighting" \
  --output "decks/sample-deck/assets/hero-cityscape.png" \
  --aspect-ratio 16:9 \
  --resolution 2K
```

| 引数 | 必須 | デフォルト | 説明 |
|------|------|-----------|------|
| `--prompt` | Yes | - | 画像生成プロンプト（英語推奨） |
| `--output` | Yes | - | 出力パス（.png） |
| `--aspect-ratio` | No | `16:9` | アスペクト比 |
| `--resolution` | No | `2K` | 解像度（1K / 2K / 4K） |
