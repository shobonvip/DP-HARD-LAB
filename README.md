# DP HARD LAB

IIDX 34 ZINRAIのDP譜面を読み取り、配置負荷とHARDゲージの生存シミュレーションで比較するローカル研究ツールです。

対象は現行AC収録の☆5～9 ANOTHERと☆10～11のNORMAL / HYPER / ANOTHER / LEGGENDARIA。取得時点のTexTage収録フラグから1,900譜面を抽出しています。外部サイトに譜面データのない曲は一覧に残り、未解析と表示します。公式収録リストとの全件照合は未実施です。

**研究版です。H指数は実プレイで校正した難易度ではなく、ノマゲの11.xなどとは互換性がありません。**

v0.3では、皿への往復・接触を保った交互の押し引き・皿と鍵盤の指分担を分離しました。連皿のたびに鍵盤から移動した扱いになる問題を修正し、皿に触れる指だけを皿位置へ動かします。認識・鍵盤配置・先読みはv0.2を引き継ぎます。詳細画面に負荷の内訳と指候補を表示します。座標・係数は未校正で、実機の寸法や切り返し速度を計測したものではありません。

旧版は `DP-HARD-LAB-v1.html`、今回の修正前は `DP-HARD-LAB-v2.html` に保存してあります。新モデルで全譜面を再計算するには `npm run human` → `npm run analyze` → `npm run export`。閲覧用HTMLも更新されます。

## 起動

**見るだけなら `DP-HARD-LAB.html` をブラウザで開いてください。サーバー・AI・追加インストールは不要です。** 検索、並び替え、譜面詳細、保存済みシミュレーションを閲覧できます。新しい条件で再計算する場合のみ以下のローカル版を使います。

Node.js 20以上で、フォルダ内で次を実行します。

```sh
npm install
npm start
```

ブラウザで http://127.0.0.1:4173 を開いてください。既に生成された表はそのまま閲覧できます。

この作業環境では同梱の新しいNodeを使っています。Windowsでシステム側の古いNodeに起因する問題が出る場合は `start.ps1` をPowerShellで実行してください。

## 更新・再計算

```sh
npm run collect
npm run analyze
npm run random
npm run analyze
npm test
```

- `collect` はキャッシュを再利用し、外部リクエストは直列・最短400ms間隔。途中失敗したリクエストは次回再実行できます。
- 外部ソースを取り直す場合は `npm run collect -- --refresh`。全件の再取得になるので通常は不要です。
- `analyze` は基本解析と表の生成、`random` はRANDOM戦略の必要能力の追加解析です。最後にもう一度 `analyze` を実行すると、追加結果を一覧に反映します。
- 保存した同じモデル版の結果は再利用します。モデルの係数を変更したらモデル版も変更するか `npm run analyze -- --force` で再計算します。
- ノマゲ表は `node scripts/normal-reference.mjs` で更新できます。曲名・譜面種別・公式難度を一致条件として照合します。

## できること

- 実譜面をノーツ列に変換。可変BPM・変拍子・CN/BSS端点を読み取り、ページと曲一覧のノーツ数に照合。
- 片手密度、配置コスト、皿・着地、連打、同時押し、CN拘束を抽出。
- 右利き仮定で正規・左右MIRROR・FLIPの8組み合わせを比較。
- 両RANDOMおよびFLIP＋両RANDOMを各8配置サンプリング。配置は曲中固定、スクラッチは移動しません。
- BAD / POOR / 空POOR、30%補正、成功打鍵回復、連続ミスの相関を含むHARD生存シミュレーション。
- 必要能力、難所の時刻、ゲージ曲線、モデル完走率と試行由来の区間、CSV一覧を表示。
- 個別画面で能力、左手比率、皿の得意度、運指、固定オプションを変えて256回再試行。

## 出力

| ファイル | 内容 |
|---|---|
| `data/catalog.json` | 取得時点の全対象譜面 |
| `data/coverage.json` | 変換成功・失敗と理由 |
| `data/charts/` | 解析用のノーツ列 |
| `data/results/` | 譜面ごとの特徴・オプション比較・試行結果 |
| `data/table.json` | 閲覧画面用一覧 |
| `data/difficulty.csv` | 表計算ソフト用の難易度一覧 |
| `docs/METHODOLOGY.md` | 仮定、数式、制約、校正の設計 |

## 重要な制約

HCNの継続回復・減少、CN保持中の取りこぼし、BSSの持続動作、微細なズレ、ソフランでのHS操作、見切り力、手のサイズ、あんみつ・皿捨て・引っ越しは十分にモデル化できていません。指候補は局所的なコスト比較で、全譜面を通じた最適運指探索ではありません。該当譜面を含め、全スコアは仮説です。

H指数は固定8オプションと両RANDOM / FLIP＋両RANDOMを、単発80%完走に必要な能力で比較した仮指数です。RANDOMは各8配置だけの標本なので推奨は不安定です。片側RANDOM / R-RANDOM / S-RANDOMは今後の拡張対象です。

実プレイ記録は未取得なので、モデルの実用精度を測定したとは言えません。ノマゲ参考値を正解ラベルとしてハードの精度を主張することもしません。

## 出典

- [TexTage 譜面集](https://textage.cc/score/) / [利用案内](https://textage.cc/score/readme.html)
- [SNJ@KMZS ノマゲ表](https://zasa.sakura.ne.jp/dp/run.php) / [評価条件](https://zasa.sakura.ne.jp/dp/readme.php)
- [iidx.org ゲージ数値](https://iidx.org/compendium/gauges_and_timing)
- [ふぇありー氏のDP運指解説](https://note.com/fairy213/n/n4d4efff02824)
- [Horie氏の親指運指解説](https://iidx.org/dp/horie_thumb)
- [KONAMI IIDX 34 ZINRAI稼働案内](https://www.konami.com/arcadegames/corporate/ja/topics/2026/0916/)

TexTage作者の観測した譜面データを利用しています。譜面やゲームに関する権利は各権利者に帰属します。公式サービスではありません。
