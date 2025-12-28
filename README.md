# NFT Viewer

美しさと堅牢性を兼ね備えた、マルチチェーン対応のNFT閲覧用ウェブアプリケーションです。

## 概要

このプロジェクトは、イーサリアム（およびPolygon等のEVM互換チェーン）上のNFTを、コントラクトアドレスとトークンID、あるいはウォレット接続によって美しく表示するためのツールです。特にオンチェーンメタデータの解析や、不安定なIPFSゲートウェイへの対策に特化しています。

## 特徴

- **プレミアム・ミニマルデザイン**: 余計な装飾を削ぎ落とし、NFTのコンテンツが主役になる洗練されたUI。
- **堅牢なメタデータ解析**: オンチェーンJSONのエスケープ漏れなどを自動修復する「外科的パース」機能を搭載。
- **マルチ・ゲートウェイ・フォールバック**: 画像の読み込みに失敗した場合、複数のIPFSゲートウェイ（Pinata, Cloudflare, ipfs.io, dweb.link）を自動で順次試行します。
- **レスポンシブ対応**: PC、タブレット、スマートフォン、あらゆるデバイスで最適な閲覧体験を提供。
- **ウォレットスキャン**: MetaMask等のウォレットを接続し、所有しているNFTを自動的にリストアップ。

## 技術スタック

- **Frontend**: HTML5, Vanilla CSS, JavaScript (ES6+)
- **Blockchain Library**: [ethers.js v6](https://docs.ethers.org/v6/)
- **Typography**: Outfit (Google Fonts)

## 使い方

1. `index.html` をブラウザで開きます（ローカル環境でも動作します）。
2. 「IDで検索」タブで、コントラクトアドレスとトークンIDを入力して表示。
3. または「ウォレットをスキャン」タブでウォレットを接続し、所有NFTを確認。

## デプロイ

このリポジトリは GitHub Pages に最適化されています。

```bash
# GitHubリポジトリを作成してプッシュ
gh repo create [YOUR_REPO_NAME] --public --source=. --remote=origin --push

# GitHub Pagesを有効化
gh api -X POST /repos/[USER]/[REPO]/pages -f build_type='workflow'
```

## ライセンス

MIT License
