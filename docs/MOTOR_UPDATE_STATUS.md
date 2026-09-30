# 動作負荷・配置難の調整

2026-09-28完了。現行データはv0.6.0。比較元はdata/table-v5.9.json、data/h5-v5.9.jsonに保存。

- src/motor-load.mjs: 手の頻度と指頻度の共有分、短い間隔での混色同時押し・担当指変更の準備負荷。
- src/human.mjs: 新負荷の採取と係数による加減。採用係数は重複軽減0.65、配置追加2。CN保持指の架空の打鍵頻度・疲労加算も修正。
- scripts/calibrate-motor.mjs: 非ソフラン☆12をHC難度で等間隔抽出160譜面。8候補、曲名hashで80/20分割。係数は学習MAEで選び保留群は選定後のみ確認。計算キャッシュdata/staging/motor-calibration-v2。
- test/motor-load.test.mjsと探索の高速化テストを含め58テスト成功。
- scripts/motor-report.mjs: 更新前後比較と配置難候補をJSON/Markdownへ出力。

校正完了: 学習125、保留35。学習MAEで重複軽減0.65・配置係数2を選択。学習MAE16.32→13.30、保留MAE16.30→14.62、保留相関0.736→0.788。係数を採用しモデルは0.6.0-motor-placement-experimental。

全2,621譜面の80%・H5再計算と本体への反映が完了。表・CSV・保存版127.1MBを更新。全譜面の特徴量監査エラー0、既知の探索上限警告due_tmrw-Aのみ。オフライン2,621結果/H5と構文を確認。ローカルサーバーの表・再計算APIはともに0.6.0-motor-placement-experimental。

☆12照合742譜面: 相関0.7455→0.7981、平均絶対順位差15.38→13.49、20pt以上の差210→161。非ソフラン659譜面: 相関0.7548→0.8120、差15.13→13.00。

配置切替上位25%の偏り−7.86→−0.78。CoMAAAAAAA改善が大きい。Logic Board/GOBBLEは改善しても大幅過小評価が残り、DXY!/TITANS RETURN/灼熱Pt.2は悪化。補正を一つずつ外す8譜面の比較はdata/motor-focus.json、解釈と限界はdocs/MOTOR_PLACEMENT.md。
