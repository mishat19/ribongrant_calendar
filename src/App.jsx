import { useState } from "react";
import CalendarPage from "./pages/CalendarPage.jsx";
import MembersPage from "./pages/MembersPage.jsx";

const TABS = [
  { id: "calendar", label: "📅 Calendrier" },
  { id: "members", label: "👥 Membres" },
];

export default function App() {
  const [tab, setTab] = useState("calendar");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold">Ribongrant Calendar</h1>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    tab === t.id
                      ? "bg-white shadow text-indigo-700"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="flex gap-2">
              <a
                href="/api/db/export"
                download
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition"
              >
                Exporter BDD
              </a>
              <label className="px-3 py-1.5 rounded-md text-sm font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition cursor-pointer">
                Importer BDD
                <input
                  type="file"
                  accept=".db"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const confirm = window.confirm(
                      "Importer cette base de données écrasera la base actuelle. Êtes-vous sûr ?",
                    );
                    if (!confirm) {
                      e.target.value = "";
                      return;
                    }
                    const formData = new FormData();
                    formData.append("db", file);
                    fetch("/api/db/import", {
                      method: "POST",
                      body: formData,
                    })
                      .then((res) => res.json())
                      .then((data) => {
                        alert(
                          data.ok
                            ? "Base de données importée avec succès. Veuillez redémarrer le serveur et rafraîchir la page."
                            : data.error || "Erreur lors de l'import",
                        );
                        if (data.ok) {
                          e.target.value = "";
                        }
                      })
                      .catch((err) => {
                        alert("Erreur lors de l'import: " + err.message);
                        e.target.value = "";
                      });
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {tab === "calendar" && <CalendarPage />}
        {tab === "members" && <MembersPage />}
      </main>
    </div>
  );
}
