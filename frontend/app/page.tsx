"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("Connecting...");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/health")
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("Backend connection failed ❌"));
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold">
          Construction Intelligence
        </h1>

        <p className="mt-4">
          Backend Status:{" "}
          <span className="font-bold">{status}</span>
        </p>
      </div>
    </main>
  );
}