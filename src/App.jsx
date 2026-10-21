import { useState } from "react";
import CalendarPage from "./pages/CalendarPage.jsx";
import MembersPage from "./pages/MembersPage.jsx";

const TABS = [
  { id: "calendar", label: "📅 Calendrier" },
  { id: "members", label: "👥 Membres" },
];

export default function App() {
  const [tab, setTab] = useState("calendar");
  const [menuOpen, setMenuOpen] = useState(false);

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const confirmImport = window.confirm(
      "Importer cette base de données écrasera la base actuelle. Êtes-vous sûr ?",
    );
    if (!confirmImport) {
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
            ? "Base de données importée avec succès."
            : data.error || "Erreur lors de l'import",
        );
        if (data.ok) {
          e.target.value = "";
          window.location.reload();
        }
      })
      .catch((err) => {
        alert("Erreur lors de l'import: " + err.message);
        e.target.value = "";
      });
    setMenuOpen(false);
  };

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
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
              >
                Fichiers ▾
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-30">
                  <a
                    href="/api/db/export"
                    download
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    Exporter BDD
                  </a>
                  <label className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                    Importer BDD
                    <input
                      type="file"
                      accept=".db"
                      className="hidden"
                      onChange={handleImport}
                    />
                  </label>
                </div>
              )}
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
