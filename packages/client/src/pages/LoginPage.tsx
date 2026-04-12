export function LoginPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-gray-900">
      <h1 className="text-4xl font-bold text-white">Mercuria</h1>
      <p className="text-gray-400">AIキャラクターと会話しよう</p>
      <div className="flex flex-col gap-3">
        <a
          href="/api/auth/google"
          className="rounded-lg bg-white px-6 py-3 text-center font-medium text-gray-900 hover:bg-gray-100"
        >
          Googleでログイン
        </a>
        <a
          href="/api/auth/github"
          className="rounded-lg bg-gray-800 px-6 py-3 text-center font-medium text-white hover:bg-gray-700"
        >
          GitHubでログイン
        </a>
      </div>
    </div>
  );
}
