import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DAYS,
  PERIODS,
  PATTERNS,
  dayLabel,
  periodLabel,
  patternLabel,
} from "../lib/availability.js";

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#d946ef",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
  "#8b5cf6",
  "#14b8a6",
];

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  role: "",
  color: COLORS[0],
  missionIds: [],
  availabilities: [],
};

export default function MembersPage() {
  const [members, setMembers] = useState([]);
  const [missions, setMissions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  const [newMission, setNewMission] = useState({ name: "", emoji: "" });
  const [error, setError] = useState(null);

  const missionById = useMemo(
    () => Object.fromEntries(missions.map((m) => [m.id, m])),
    [missions],
  );

  const load = useCallback(async () => {
    try {
      const [mems, miss] = await Promise.all([
        api("/api/members"),
        api("/api/missions"),
      ]);
      setMembers(mems);
      setMissions(miss);
      setError(null);
    } catch {
      setError("API indisponible — lance `npm run dev:api`");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (m) => {
    setForm({
      name: m.name,
      email: m.email || "",
      phone: m.phone || "",
      role: m.role || "",
      color: m.color,
      missionIds: m.missionIds || [],
      availabilities: (m.availabilities || []).map((a) => ({
        day: a.day,
        period: a.period,
        pattern: a.pattern,
      })),
    });
    setEditingId(m.id);
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      if (editingId) {
        await api(`/api/members/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        await api("/api/members", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!confirm("Supprimer ce membre ?")) return;
    await api(`/api/members/${id}`, { method: "DELETE" });
    load();
  };

  const addMission = (missionId) => {
    if (!missionId || form.missionIds.includes(missionId)) return;
    setForm((f) => ({ ...f, missionIds: [...f.missionIds, missionId] }));
  };

  const removeMission = (missionId) => {
    setForm((f) => ({
      ...f,
      missionIds: f.missionIds.filter((id) => id !== missionId),
    }));
  };

  const addAvailability = () => {
    setForm((f) => ({
      ...f,
      availabilities: [
        ...f.availabilities,
        { day: "mon", period: "lunch", pattern: "every" },
      ],
    }));
  };

  const updateAvailability = (index, patch) => {
    setForm((f) => ({
      ...f,
      availabilities: f.availabilities.map((a, i) =>
        i === index ? { ...a, ...patch } : a,
      ),
    }));
  };

  const removeAvailability = (index) => {
    setForm((f) => ({
      ...f,
      availabilities: f.availabilities.filter((_, i) => i !== index),
    }));
  };

  const createMission = async (e) => {
    e.preventDefault();
    if (!newMission.name.trim()) return;
    try {
      const created = await api("/api/missions", {
        method: "POST",
        body: JSON.stringify(newMission),
      });
      setNewMission({ name: "", emoji: "" });
      await load();
      if (showForm) addMission(created.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteMission = async (id) => {
    if (!confirm("Supprimer cette mission ? Elle sera retirée de tous les membres.")) return;
    await api(`/api/missions/${id}`, { method: "DELETE" });
    load();
  };

  const availableMissions = missions.filter(
    (m) => !form.missionIds.includes(m.id),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Membres</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMissions((s) => !s)}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50"
          >
            🎯 Missions
          </button>
          <button
            onClick={openNew}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
          >
            + Nouveau membre
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2">
          {error}
        </div>
      )}

      {showMissions && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Missions disponibles
          </h3>
          <div className="flex flex-wrap gap-2">
            {missions.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-sm text-indigo-700"
              >
                {m.emoji && <span>{m.emoji}</span>}
                {m.name}
                <button
                  onClick={() => deleteMission(m.id)}
                  className="text-indigo-400 hover:text-red-500"
                  title="Supprimer"
                >
                  ✕
                </button>
              </span>
            ))}
            {missions.length === 0 && (
              <p className="text-sm text-slate-400">Aucune mission.</p>
            )}
          </div>
          <form onSubmit={createMission} className="flex gap-2">
            <input
              value={newMission.emoji}
              onChange={(e) => setNewMission({ ...newMission, emoji: e.target.value })}
              placeholder="🎯"
              className="w-14 rounded-lg border border-slate-300 px-2 py-2 text-sm text-center"
              maxLength={2}
            />
            <input
              value={newMission.name}
              onChange={(e) => setNewMission({ ...newMission, name: e.target.value })}
              placeholder="Nom de la nouvelle mission"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              Ajouter
            </button>
          </form>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((m) => (
          <div
            key={m.id}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ background: m.color }}
                />
                <div>
                  <h3 className="font-semibold">{m.name}</h3>
                  {m.role && <p className="text-xs text-slate-500">{m.role}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openEdit(m)}
                  className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
                >
                  ✏️
                </button>
                <button
                  onClick={() => remove(m.id)}
                  className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-red-50 hover:text-red-600"
                >
                  🗑️
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {(m.missionIds || []).map((id) => {
                const mission = missionById[id];
                if (!mission) return null;
                return (
                  <span
                    key={id}
                    className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2 py-0.5"
                  >
                    {mission.emoji} {mission.name}
                  </span>
                );
              })}
              {(m.missionIds || []).length === 0 && (
                <span className="text-[11px] text-slate-400">Aucune mission</span>
              )}
            </div>

            <div className="mt-3 space-y-1 text-xs text-slate-500">
              {m.email && <p>✉️ {m.email}</p>}
              {m.phone && <p>📞 {m.phone}</p>}
            </div>

            <div className="mt-3 border-t border-slate-100 pt-2">
              <p className="text-[11px] font-medium text-slate-500 mb-1">
                Disponibilités ({(m.availabilities || []).length})
              </p>
              <ul className="space-y-0.5">
                {(m.availabilities || []).map((a) => (
                  <li key={a.id} className="text-[11px] text-slate-600">
                    {dayLabel(a.day)} · {periodLabel(a.period)} ·{" "}
                    {patternLabel(a.pattern)}
                  </li>
                ))}
                {(m.availabilities || []).length === 0 && (
                  <li className="text-[11px] text-slate-400">
                    Aucune disponibilité
                  </li>
                )}
              </ul>
            </div>
          </div>
        ))}
        {members.length === 0 && !error && (
          <p className="text-sm text-slate-400 col-span-full">
            Aucun membre pour l'instant.
          </p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <form
            onSubmit={submit}
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-5 space-y-4 my-8"
          >
            <h3 className="font-semibold text-lg">
              {editingId ? "Modifier le membre" : "Nouveau membre"}
            </h3>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-slate-600">Nom *</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Rôle</span>
                <input
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Téléphone</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Couleur :</span>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-6 h-6 rounded-full border-2 ${
                    form.color === c ? "border-slate-800 scale-110" : "border-transparent"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>

            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Missions</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {form.missionIds.map((id) => {
                  const mission = missionById[id];
                  if (!mission) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-sm text-indigo-700"
                    >
                      {mission.emoji} {mission.name}
                      <button
                        type="button"
                        onClick={() => removeMission(id)}
                        className="text-indigo-400 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
                {form.missionIds.length === 0 && (
                  <span className="text-xs text-slate-400">
                    Aucune mission assignée
                  </span>
                )}
              </div>
              <select
                value=""
                onChange={(e) => addMission(Number(e.target.value))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">+ ajouter une mission…</option>
                {availableMissions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.emoji} {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">
                  Disponibilités
                </span>
                <button
                  type="button"
                  onClick={addAvailability}
                  className="text-xs px-3 py-1 rounded-lg border border-slate-300 hover:bg-slate-50"
                >
                  + ajouter une disponibilité
                </button>
              </div>
              <div className="space-y-2">
                {form.availabilities.map((a, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <select
                      value={a.day}
                      onChange={(e) => updateAvailability(i, { day: e.target.value })}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
                    >
                      {DAYS.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={a.period}
                      onChange={(e) => updateAvailability(i, { period: e.target.value })}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
                    >
                      {PERIODS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={a.pattern}
                      onChange={(e) => updateAvailability(i, { pattern: e.target.value })}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
                    >
                      {PATTERNS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeAvailability(i)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
                {form.availabilities.length === 0 && (
                  <p className="text-xs text-slate-400">
                    Aucune disponibilité renseignée.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
              >
                {editingId ? "Enregistrer" : "Créer"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
