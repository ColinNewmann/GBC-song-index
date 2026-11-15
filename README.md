# 《GIRLS BAND CRY》歌曲索引

一個繁體中文的非官方歌曲索引。從片頭曲、第一集插曲和片尾曲開始，每首歌都有官方影片播放器、演出版本、動畫使用資訊、製作名單、發行紀錄與官方完整版串流連結。

## 在本機開啟

在專案根目錄使用 Node.js 22 或更新版本執行：

```sh
node scripts/build.mjs
```

執行 `python -m http.server 8000 --directory dist`，再用瀏覽器開啟 `http://localhost:8000`。直接開啟 `dist/index.html` 也能瀏覽頁面，但 YouTube 可能因本機檔案沒有網頁來源而無法播放。

## 新增歌曲

先讀 [AGENTS.md](AGENTS.md)，再依欄位規格新增一份 `songs/*.json`。建置程式會檢查必填欄位及排序，並從資料產生歌曲頁、首頁卡片、收錄數量和下一首連結。

本次用第三首〈誰にもなれない私だから〉驗證。初版有兩首，新增第三首的 JSON 後重跑建置，首頁增為三首，單曲頁、索引和下一首連結也隨之更新。建置程式、樣式和發布流程的檔案皆可沿用。

## 發布到 GitHub Pages

將專案推送到新的公開 GitHub Repository 的 `main` 分支。在 Repository 的 **Settings → Pages** 將 **Source** 選為 **GitHub Actions**，再到 **Actions → Deploy to GitHub Pages** 執行工作流程。完成後，從環境的部署結果取得實際網站網址。往後一旦推送到 `main`，工作流程會重新建置和發布。
