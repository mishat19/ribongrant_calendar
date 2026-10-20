import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Assignment, Member, MemberDraft, Mission } from '../domain/types';
import {
  deleteMember as dbDeleteMember,
  deleteMission as dbDeleteMission,
  insertMember,
  insertMission,
  listAssignments,
  listMembers,
  listMissions,
  setOccurrenceAssignments,
  updateMember,
  updateMission,
} from '../db/database';

interface TeamState {
  members: Member[];
  missions: Mission[];
  assignments: Assignment[];
  loaded: boolean;
  load: (db: SQLiteDatabase) => Promise<void>;
  createMember: (db: SQLiteDatabase, draft: MemberDraft) => Promise<Member>;
  editMember: (db: SQLiteDatabase, id: number, draft: MemberDraft) => Promise<Member>;
  removeMember: (db: SQLiteDatabase, id: number) => Promise<void>;
  createMission: (db: SQLiteDatabase, name: string, emoji: string | null) => Promise<Mission>;
  editMission: (db: SQLiteDatabase, id: number, name: string, emoji: string | null) => Promise<void>;
  removeMission: (db: SQLiteDatabase, id: number) => Promise<void>;
  assignOccurrence: (
    db: SQLiteDatabase,
    eventId: number,
    occurrence: string,
    memberIds: number[]
  ) => Promise<void>;
}

export const useTeamStore = create<TeamState>((set) => ({
  members: [],
  missions: [],
  assignments: [],
  loaded: false,

  load: async (db) => {
    const [members, missions, assignments] = await Promise.all([
      listMembers(db),
      listMissions(db),
      listAssignments(db),
    ]);
    set({ members, missions, assignments, loaded: true });
  },

  createMember: async (db, draft) => {
    const member = await insertMember(db, draft);
    set((state) => ({
      members: [...state.members, member].sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
      ),
    }));
    return member;
  },

  editMember: async (db, id, draft) => {
    const member = await updateMember(db, id, draft);
    set((state) => ({
      members: state.members
        .map((m) => (m.id === id ? member : m))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })),
    }));
    return member;
  },

  removeMember: async (db, id) => {
    await dbDeleteMember(db, id);
    set((state) => ({
      members: state.members.filter((m) => m.id !== id),
      assignments: state.assignments.filter((a) => a.memberId !== id),
      missions: state.missions.map((mission) => ({
        ...mission,
        memberIds: mission.memberIds?.filter((mid) => mid !== id),
      })),
    }));
  },

  createMission: async (db, name, emoji) => {
    const mission = await insertMission(db, name, emoji);
    set((state) => ({
      missions: [...state.missions, mission].sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
      ),
    }));
    return mission;
  },

  editMission: async (db, id, name, emoji) => {
    await updateMission(db, id, name, emoji);
    set((state) => ({
      missions: state.missions
        .map((m) => (m.id === id ? { ...m, name: name.trim(), emoji: emoji?.trim() || null } : m))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })),
    }));
  },

  removeMission: async (db, id) => {
    await dbDeleteMission(db, id);
    set((state) => ({
      missions: state.missions.filter((m) => m.id !== id),
      members: state.members.map((member) => ({
        ...member,
        missionIds: member.missionIds.filter((mid) => mid !== id),
      })),
    }));
  },

  assignOccurrence: async (db, eventId, occurrence, memberIds) => {
    await setOccurrenceAssignments(db, eventId, occurrence, memberIds);
    set((state) => ({
      assignments: [
        ...state.assignments.filter(
          (a) => !(a.eventId === eventId && a.occurrence === occurrence)
        ),
        ...memberIds.map((memberId, index) => ({
          id: -1 - index,
          eventId,
          memberId,
          occurrence,
        })),
      ],
    }));
  },
}));
