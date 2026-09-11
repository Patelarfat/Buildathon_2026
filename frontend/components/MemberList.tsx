"use client";

import { useEffect, useState } from "react";
import {
  ProjectMember,
  ProjectRole,
  User,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  getUsers,
  createUser,
} from "../lib/api";

interface MemberListProps {
  projectId: number;
  members: ProjectMember[];
  onMembersChanged: () => void;
}

const ROLES: { value: ProjectRole; label: string }[] = [
  { value: "PROJECT_MANAGER", label: "Project Manager" },
  { value: "SITE_SUPERVISOR", label: "Site Supervisor" },
  { value: "SAFETY_OFFICER", label: "Safety Officer" },
  { value: "CONTRACTOR", label: "Contractor" },
  { value: "ADMIN", label: "Admin" },
];

export const roleColors: Record<ProjectRole, { bg: string; text: string; border: string }> = {
  PROJECT_MANAGER: { bg: "bg-blue-900/30", text: "text-blue-400", border: "border-blue-500/30" },
  SITE_SUPERVISOR: { bg: "bg-emerald-900/30", text: "text-emerald-400", border: "border-emerald-500/30" },
  SAFETY_OFFICER: { bg: "bg-amber-900/30", text: "text-amber-400", border: "border-amber-500/30" },
  CONTRACTOR: { bg: "bg-purple-900/30", text: "text-purple-400", border: "border-purple-500/30" },
  ADMIN: { bg: "bg-rose-900/30", text: "text-rose-400", border: "border-rose-500/30" },
};

export default function MemberList({ projectId, members, onMembersChanged }: MemberListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [selectedRole, setSelectedRole] = useState<ProjectRole>("SITE_SUPERVISOR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick user creation state
  const [showQuickUserModal, setShowQuickUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("ENGINEER");

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
      if (data.length > 0 && selectedUserId === "") {
        setSelectedUserId(data[0].id);
      }
    } catch {}
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError("Please select a user");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await addProjectMember(projectId, {
        user_id: Number(selectedUserId),
        role: selectedRole,
      });
      setShowAddForm(false);
      onMembersChanged();
    } catch (err: any) {
      setError(err.message || "Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuickUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    try {
      const created = await createUser({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        role: newUserRole,
      });
      await loadUsers();
      setSelectedUserId(created.id);
      setShowQuickUserModal(false);
      setNewUserName("");
      setNewUserEmail("");
    } catch (err: any) {
      alert(err.message || "Failed to create user");
    }
  };

  const handleRoleChange = async (userId: number, newRole: ProjectRole) => {
    try {
      await updateProjectMemberRole(projectId, userId, { role: newRole });
      onMembersChanged();
    } catch (err: any) {
      alert(err.message || "Failed to update role");
    }
  };

  const handleRemoveMember = async (userId: number, userName?: string) => {
    if (
      !confirm(
        `Are you sure you want to remove ${userName || "this member"} from the project?`
      )
    )
      return;

    try {
      await removeProjectMember(projectId, userId);
      onMembersChanged();
    } catch (err: any) {
      alert(err.message || "Failed to remove member");
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>👥 Project Team & Members</span>
            <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
              {members.length}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Team members, site managers, and safety officers assigned to this project
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-sm"
        >
          {showAddForm ? "Close Form" : "+ Add Member"}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddMember}
          className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">Assign Member to Project</h4>
            <button
              type="button"
              onClick={() => setShowQuickUserModal(true)}
              className="text-xs text-blue-400 hover:underline"
            >
              + Register New User
            </button>
          </div>

          {error && (
            <div className="p-2 bg-rose-900/30 border border-rose-800 text-rose-300 text-xs rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Select User *
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              >
                {users.length === 0 && <option value="">No users found</option>}
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Project Role *
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as ProjectRole)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedUserId}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              {loading ? "Adding..." : "Add to Project"}
            </button>
          </div>
        </form>
      )}

      {/* Quick User Modal */}
      {showQuickUserModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 space-y-4">
            <h4 className="text-base font-bold text-white">Create New User Account</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Email *</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. ramesh@example.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">System Role</label>
                <input
                  type="text"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  placeholder="e.g. ENGINEER, WORKER"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowQuickUserModal(false)}
                className="px-3 py-1 text-xs text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateQuickUser}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
          <p className="text-slate-400 text-sm">No members assigned to this project yet.</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-3 text-xs font-semibold text-blue-400 hover:text-blue-300 underline"
          >
            Assign the first team member
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          {members.map((member) => {
            const roleStyle = roleColors[member.role] || {
              bg: "bg-slate-800",
              text: "text-slate-300",
              border: "border-slate-700",
            };

            return (
              <div
                key={member.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-bold text-sm">
                    {member.user?.name ? member.user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {member.user?.name || `User ID #${member.user_id}`}
                    </h4>
                    <p className="text-xs text-slate-400">{member.user?.email || "No email"}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-auto">
                  <select
                    value={member.role}
                    onChange={(e) =>
                      handleRoleChange(member.user_id, e.target.value as ProjectRole)
                    }
                    className={`text-xs font-semibold rounded-lg px-2.5 py-1 bg-slate-900 border ${roleStyle.border} ${roleStyle.text} focus:outline-none`}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value} className="bg-slate-900 text-white">
                        {r.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() =>
                      handleRemoveMember(member.user_id, member.user?.name)
                    }
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                    title="Remove from project"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
