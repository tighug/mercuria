import { Routes, Route } from "react-router-dom";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<div className="flex h-screen items-center justify-center"><h1 className="text-3xl font-bold">Mercuria</h1></div>} />
    </Routes>
  );
}
