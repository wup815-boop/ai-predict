"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold mb-2">AI Predict</h1>
        <p className="text-gray-500 text-sm mb-6">
          AIプロダクトの成長を予測して目利き履歴を残す
        </p>
        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Googleでログイン
        </button>
        <p className="text-xs text-gray-400 mt-4">
          予測履歴を保存するためにログインが必要です
        </p>
      </div>
    </main>
  );
}
