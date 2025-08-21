// src/pages/AddPayer.tsx
import { useState } from "react";

export default function AddPayer() {
  const [payerName, setPayerName] = useState("");
  const [fields, setFields] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payerName || !fields) return;

    const newPayer = {
      [payerName]: fields.split(",").map(f => f.trim()),
    };

    const existing = JSON.parse(localStorage.getItem("dynamicPayers") || "{}");
    localStorage.setItem("dynamicPayers", JSON.stringify({ ...existing, ...newPayer }));

    alert(`✅ Payer "${payerName}" added!`);
    setPayerName("");
    setFields("");
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Add New Payer</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Payer Name"
          value={payerName}
          onChange={(e) => setPayerName(e.target.value)}
          className="border p-2 w-full"
        />
        <textarea
          placeholder="Fields (comma separated)"
          value={fields}
          onChange={(e) => setFields(e.target.value)}
          className="border p-2 w-full"
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2">
          Add Payer
        </button>
      </form>
    </div>
  );
}
