# SNS サムネイル・共有表示受入

## 今回の範囲
- 基点 main `cdb0a4e00687a4d49e4045fc0dec5fbab708a602`。共有先は既存 Codeberg URL を維持し、登録・正式 URL を切り替えない。
- `assets/social-preview.png` は1200×630の固定紹介画像。実ゲームCSSの配色、実日本語ラベル、既存fallbackお題 `[6,15,24]` と未タップ欄を紹介用に再構成。実プレイ結果・個人名・ランキング値を含まない。
- `tools/render-social-preview.cjs` がSVGを作成し、同SVGを既存システムlibrsvg/cairoでPNG化。画像API・外部素材なし。編集元SVGはrepoに保持し配信対象には含めない。
- OG/Twitter画像URLはGitHub版のassetを指す移行準備。現Codeberg配信にこのPRが反映されたとは扱わない。Pages設定・GitHub配信の成立と現在登録URLの切替は別判断。公開カード表示は未確認。
- ホームと確定結果の全15言語に `#あなたの1秒って #ゲーム制作` を各1回追加。既存数値・結果状態・URL・名前を共有しない条件を維持。最大時間付近の値で280文字の保守的重み検査。

## 検証
- 既存browser-smokeは維持。追加 `share-visual.cjs` は全外部HTTPをmock/deny、同originもGET/HEADだけ固定HTMLを直接fulfillしredirect経路を作らず、Service WorkerとWebSocketを遮断してからページを開く。匿名ローカルfixtureのみ、score送信試行0を検査。
- 15言語×縦横×ホーム/結果×Chromium/WebKitのX・ランキング可視、祖先opacity、44px、中心hit、各viewportのtap前後件数+1と現在言語の文言・結果を含む新規X intentを検査。非表示・透明な親をnegative対照とし、スクリーンショットをCIに保存。
- 投稿画面はwindow.openのmockで捕捉し、実投稿・本番プレイはしない。言語変更後も確定score/targets/taps不変を確認。
- PR前の検査のため今回work branchだけpush対象に追加。Pages artifact/deployを `push && refs/heads/main` に厳格化、concurrencyをref別にして作業branchが公開main実行を取り消さない。runner/公開先/権限は変更しない。
- `check-site.py` がPNG署名・寸法を検査し、公開対象はindex.html/.nojekyll/当該PNGだけ。コピー後全bytes一致を検査。

本人iPhone Safariの表示受入・公開SNSカードは未確認。マージは本人。戻す場合は本差分をrevertし、名前/自己ベスト/音量/保存済み記録を削除しない。

コピー代替のblocked popupは既存browser-smokeとshare.testで維持。新しいshare-visualは成功popup stubのfresh intentを各viewportごとに確認する独立検査。
