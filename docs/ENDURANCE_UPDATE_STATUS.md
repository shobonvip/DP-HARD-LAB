# v0.6.1の作業状態

2026-09-28。目的は連皿の過小評価と比較対象のBPM誤分類を修正すること。

完了:
- DP攻略コメントを確認。TITANS RETURN(L)はソフラン/HCN、灼熱Pt.2(A)は連皿の持続・体力、GOBBLE(H)は隣接白黒同時押し・付加ノーツ付き縦連・無理皿・BADハマりが難所として挙げられる。
- src/tempo.mjs と scripts/tempo-metadata.mjs。data/chart-tempos.json に2,621譜面分のテンポ情報。☆12は87譜面が変速、ereter照合内では85。table.jsonのbpmとtempoを譜面別に更新し、従来の曲共通値はsourceBpmに保持。
- src/human.mjs に皿成分の重複軽減保護と、8秒で減衰する皿移動距離の持続負荷。規則的なリズムでも身体運動は残る。
- scripts/calibrate-endurance.mjs で160譜面（学習133/保留27）・7候補比較。学習MAEのみで保護1、持続負荷2を選び、保留相関0.7084→0.7927、MAE17.52→15.10を確認。data/scratch-endurance-calibration.json。新しい実プレイ検証ではない。
- モデル0.6.1-scratch-endurance-experimental。採用後のテスト62件成功。
- UIに連皿持続負荷を追加、CSVに新指標とBPM/変速フラグ、auditに元譜面とのテンポ照合。

完了（2026-09-29）:
- human-batch --workers=8 --output=data/staging/results-v61
- ereter-h5-batch --all --workers=8 --output=data/staging/h5-v61
- 比較元data/table-v6.0.json、data/h5-v6.0.jsonを保持。

実施済みの反映手順:
publish-results --source=data/staging/results-v61 → compile-h5 --source=data/staging/h5-v61 → analyze → endurance-report → ereter-h5-report --source=data/staging/h5-v61 → export → audit --verify-features → verify-offline。
docs/SCRATCH_ENDURANCE.md とdata/endurance-comparison.jsonを確認して、改善/悪化を報告。旧v0.6.0の非ソフラン分析は誤分類を含む歴史的集計として注記する。サーバーを再起動しAPIと表のバージョンを揃える。

結果: 全2,621譜面を反映、☆12は752譜面すべて解析済み。ereter照合742譜面の相関0.7981→0.8155、平均絶対順位差13.49→12.91、20pt以上の差161→157。修正済み非ソフラン657譜面は相関0.8162→0.8342。灼熱2曲は改善、Makin' It/dica dicaは過大評価が悪化。GOBBLE/Logic Boardの必要能力は不変。

検証: 採用後62テスト成功。全2,621件の特徴量監査エラー0、due_tmrw-Aの探索上限警告1。保存版129.9MBの全件・H5・構文検証成功。旧モデル混在レポートは出力前に拒否することを確認。サイト/APIともv0.6.1で応答し、TITANS RETURN(L)のBPMは97～194。サーバー稼働セッション29773。
