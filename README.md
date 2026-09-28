# ウマLGTM 🏇

競走馬の LGTM 画像サイト（自分用）。画像をクリックすると `![LGTM](...)` がコピーされるので、PR レビューにそのまま貼れます。

## 画像の追加

`photos/` に写真を置いて push するだけです。GitHub Actions が LGTM を合成して GitHub Pages に公開します。

```
photos/
├── イクイノックス/          ← フォルダ名が馬名になる
│   ├── 01.jpg
│   └── 02.jpg
└── ドウデュース_有馬記念.jpg  ← フォルダなしの場合は「_」より前が馬名
```

- 対応形式: jpg / png / webp / avif / gif（1 コマ目）/ tiff。iPhone の HEIC は非対応なので jpg に変換してください。
- 長辺 500px に縮小して、中央に LGTM を合成します。
- 出力ファイル名は元画像のハッシュです。デザインを変えて再ビルドしても、過去に貼った URL は切れません。

## ローカルで確認

```sh
npm install
npm run dev   # → http://localhost:8080/
```

## 使い方

- **クリック**: その画像をコピー
- **ランダムコピー** ボタン / `R` キー: ランダムに 1 枚コピー
- **ランダム / 新着順**: 表示の切り替え（`?view=random` / `?view=latest`）
- **馬名チップ**: 馬ごとに絞り込み（`?horse=イクイノックス`）。絞り込み中はランダムコピーもその馬から選ばれます
- **コピー形式**: Markdown / HTML（幅 300px 指定）/ URL

## 公開の初回設定

リポジトリの Settings → Pages → Source を **GitHub Actions** にしてください。
