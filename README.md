# ウマLGTM 🏇

競走馬の LGTM 画像サイト（自分用）。画像をクリックすると `![LGTM](...)` がコピーされるので、PR レビューにそのまま貼れます。

公開先: https://nodokamome.github.io/uma-lgtm/

## 写真の取り込み（Wikimedia Commons）

写真は [Wikimedia Commons](https://commons.wikimedia.org/) の自由ライセンス（CC0 / パブリックドメイン / CC BY / CC BY-SA）のものだけを使っています。
netkeiba や Google 画像検索の写真は著作権があり転載できないため使いません。

```sh
npm run fetch                    # horses.json の全馬（1 頭あたり最大 8 枚）
npm run fetch -- イクイノックス   # 指定した馬だけ
```

- 馬を増やすときは `horses.json` に `{ "name": "馬名", "commons": "Commons のカテゴリ名" }` を追加します。
  カテゴリ名は `https://commons.wikimedia.org/wiki/Category:Equinox_(horse)` の `Category:` より後ろの部分です。
- 取り込むと写真と一緒に `.json`（撮影者・ライセンス）が保存され、LGTM 画像の下端にクレジットが入ります。
- 馬が写っていない写真などを外すときは、その pageid を `horses.json` の `exclude` に足してファイル（.jpg と .json）を消し、もう一度 `npm run fetch` すると別の写真で補充されます。
- 合成後の画像は元画像のライセンスに従います（CC BY-SA のものは CC BY-SA）。

## 画像の追加（自分の写真）

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

## フォント

LGTM の文字は [Black Ops One](https://fonts.google.com/specimen/Black+Ops+One)（SIL Open Font License、[fonts/OFL.txt](fonts/OFL.txt)）です。
ビルド時に図形へ変換して合成するので、環境によって見た目が変わることはありません。
別のフォントにしたいときは `fonts/` に TTF/OTF を置き、[scripts/build.mjs](scripts/build.mjs) の `FONT_FILE` を書き換えてください。
