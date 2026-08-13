/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ダークテーマ パレット（デザイン仕様）
        base: "#0D1B2A", // 背景（ダークネイビー）
        card: "#162636", // カード背景
        line: "#1E3448", // ボーダー
        accent: {
          DEFAULT: "#16A085", // アクセント（ティール）
          hover: "#138D75", // ボタンhover用の派生色
        },
        content: "#E8EDF2", // テキスト メイン
        muted: "#8899AA", // テキスト サブ
        faint: "#576574", // テキスト 薄い
        success: {
          DEFAULT: "#27AE60", // 選択成功（緑）
          bg: "#0F2A1E", // 選択済みカード背景
        },
        danger: "#E74C3C", // エラー（赤）
        steel: "#2C3E50", // VS表示 / フッター
        warn: "#E0A458", // 注意書き用の派生色
      },
    },
  },
  plugins: [],
};
