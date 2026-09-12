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
import { Users, UserPlus, Trash2, X, Plus, ShieldCheck } from "lucide-react";

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

export const roleColors: Record<
  ProjectRole,
  { bg: string; text: string; border: string }
> = {
  PROJECT_MANAGER: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
  },
  SITE_SUPERVISOR: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
  },
  SAFETY_OFFICER: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
  },
  CONTRACTOR: {
    bg: "bg-purple-50",
    text: "text-purple-800",
    border: "border-purple-200",
  },
  ADMIN: {
    bg: "bg-rose-50",
    text: "text-rose-800",
    border: "border-rose-200",
  },
};

export default function MemberList({
  projectId,
  members,
  onMembersChanged,
}: MemberListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [selectedRole, setSelectedRole] =
    useState<ProjectRole>("SITE_SUPERVISOR");
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
    <div className="bg-white border border-[#E7E5E4] rounded-2xl p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E7E5E4]">
        <div>
          <h3 className="text-lg font-bold text-[#171717] flex items-center space-x-2">
            <Users className="w-5 h-5 text-[#F5B82E]" />
            <span>Project Team & Members</span>
            <span className="text-xs bg-[#F6F6F3] text-[#171717] border border-[#E7E5E4] px-2.5 py-0.5 rounded-full font-semibold">
              {members.length}
            </span>
          </h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Site managers, safety officers, and team members assigned to this project
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3.5 py-2 text-xs font-semibold bg-[#F5B82E] hover:bg-[#e0a724] text-[#0B0F10] rounded-xl transition-all shadow-xs flex items-center space-x-1.5"
        >
          <UserPlus className="w-4 h-4 stroke-[2.5]" />
          <span>{showAddForm ? "Close Form" : "+ Add Member"}</span>
        </button>
      </div>

      {/* Add Member Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddMember}
          className="bg-[#F6F6F3] p-5 rounded-2xl border border-[#E7E5E4] space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#171717]">
              Assign Member to Project
            </h4>
            <button
              type="button"
              onClick={() => setShowQuickUserModal(true)}
              className="text-xs font-semibold text-[#171717] hover:text-[#F5B82E] underline"
            >
              + Register New User
            </button>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Select User *
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(Number(e.target.value))}
                className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
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
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Project Role *
              </label>
              <select
                value={selectedRole}
                onChange={(e) =>
                  setSelectedRole(e.target.value as ProjectRole)
                }
                className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-1.5 text-xs text-[#6B7280] hover:text-[#171717]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedUserId}
              className="px-4 py-2 bg-[#F5B82E] hover:bg-[#e0a724] disabled:opacity-50 text-[#0B0F10] rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              {loading ? "Adding..." : "Add to Project"}
            </button>
          </div>
        </form>
      )}

      {/* Register New User Quick Modal */}
      {showQuickUserModal && (
        <div className="fixed inset-0 bg-[#0B0F10]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-[#E7E5E4] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7E5E4] pb-3">
              <h4 className="text-base font-bold text-[#171717]">
                Create User Account
              </h4>
              <button
                onClick={() => setShowQuickUserModal(false)}
                className="text-[#6B7280] hover:text-[#171717]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. ramesh@example.com"
                  className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  System Role
                </label>
                <input
                  type="text"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  placeholder="e.g. ENGINEER, WORKER"
                  className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-[#E7E5E4]">
              <button
                type="button"
                onClick={() => setShowQuickUserModal(false)}
                className="px-3 py-1.5 text-xs text-[#6B7280]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateQuickUser}
                className="px-4 py-2 bg-[#F5B82E] hover:bg-[#e0a724] text-[#0B0F10] rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members List or Compact Empty State */}
      {members.length === 0 ? (
        <div className="bg-[#F6F6F3]/60 border border-[#E7E5E4] rounded-2xl p-6 text-center space-y-3 my-2">
          <div className="w-12 h-12 bg-amber-50 text-[#F5B82E] border border-amber-200/60 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <Users className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#171717]">
              No team members assigned
            </h4>
            <p className="text-xs text-[#6B7280] max-w-xs mx-auto mt-0.5">
              Assign project members to coordinate site operations and responsibilities.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-[#F5B82E] hover:bg-[#e0a724] text-[#0B0F10] text-xs font-bold rounded-xl shadow-xs transition-all inline-flex items-center space-x-1.5"
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Assign First Member</span>
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[#E7E5E4] bg-white rounded-2xl border border-[#E7E5E4] overflow-hidden">
          {members.map((member) => {
            const roleStyle = roleColors[member.role] || {
              bg: "bg-slate-100",
              text: "text-slate-800",
              border: "border-slate-200",
            };

            return (
              <div
                key={member.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F6] transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-[#F6F6F3] border border-[#E7E5E4] flex items-center justify-center text-[#171717] font-bold text-sm shadow-xs">
                    {member.user?.name
                      ? member.user.name.charAt(0).toUpperCase()
                      : "U"}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#171717]">
                      {member.user?.name || `User ID #${member.user_id}`}
                    </h4>
                    <p className="text-xs text-[#6B7280]">
                      {member.user?.email || "No email"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-auto">
                  <select
                    value={member.role}
                    onChange={(e) =>
                      handleRoleChange(
                        member.user_id,
                        e.target.value as ProjectRole
                      )
                    }
                    className={`text-xs font-semibold rounded-xl px-2.5 py-1.5 bg-[#F6F6F3] border ${roleStyle.border} ${roleStyle.text} focus:outline-none`}
                  >
                    {ROLES.map((r) => (
                      <option
                        key={r.value}
                        value={r.value}
                        className="bg-white text-[#171717]"
                      >
                        {r.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() =>
                      handleRemoveMember(member.user_id, member.user?.name)
                    }
                    className="p-1.5 text-[#6B7280] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Remove from project"
                  >
                    <Trash2 className="w-4 h-4" />
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
