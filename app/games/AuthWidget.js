"use client";
// Login/register/logout widget — only ever rendered under /games (see
// layout.js's AuthProvider), never in the main site nav. When logged out,
// this is just a small trigger button; the form itself lives in a popup so
// it isn't permanently taking up space on the page. Reads its open/closed
// state from the shared AuthContext so other components (e.g. Tetris's
// game-over prompt) can open this exact same modal.

import { useState } from "react";
import { useAuth } from "./AuthContext";

export default function AuthWidget() {
  const {
    loggedIn,
    username,
    loading,
    refresh,
    modalOpen: open,
    setModalOpen: setOpen,
  } = useAuth();
  const [mode, setMode] = useState("login"); // login | register
  const [form, setForm] = useState({
    username: "",
    password: "",
    rememberMe: false,
  });
  const [status, setStatus] = useState("idle"); // idle | submitting | error
  const [error, setError] = useState("");
  const [noUserPrompt, setNoUserPrompt] = useState(false);

  async function callAuth(endpoint) {
    const res = await fetch(`/api/games/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    return { res, data: await res.json() };
  }

  async function submit(e) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    setNoUserPrompt(false);
    try {
      const { res, data } = await callAuth(mode);
      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "Something went wrong.");
        if (mode === "login" && data.reason === "no-user") {
          setNoUserPrompt(true);
        }
        return;
      }
      setStatus("idle");
      setForm({ username: "", password: "", rememberMe: false });
      setOpen(false);
      refresh();
    } catch {
      setStatus("error");
      setError("Network error.");
    }
  }

  // Login failed because that username isn't registered — offer to create
  // it with the same details instead of making them retype everything into
  // a separate "sign up" form.
  async function createFromPrompt() {
    setStatus("submitting");
    setError("");
    try {
      const { res, data } = await callAuth("register");
      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "Something went wrong.");
        setNoUserPrompt(false);
        return;
      }
      setStatus("idle");
      setForm({ username: "", password: "", rememberMe: false });
      setNoUserPrompt(false);
      setOpen(false);
      refresh();
    } catch {
      setStatus("error");
      setError("Network error.");
    }
  }

  async function logout() {
    await fetch("/api/games/auth/logout", { method: "POST" });
    refresh();
  }

  if (loading) return null;

  if (loggedIn) {
    return (
      <div className="flex items-center gap-3 font-body text-sm text-white/70">
        <span>
          Logged in as <span className="text-white">{username}</span>
        </span>
        <button
          onClick={logout}
          className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-white/10 px-4 py-2 font-body text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20"
      >
        Log in
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-2xl bg-[#0b0b12] p-6 ring-1 ring-white/10"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-xl text-white">
                {mode === "login" ? "Log in" : "Sign up"}
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-white/50 hover:text-white/80"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={submit}
              className="flex flex-col gap-3 font-body text-sm"
            >
              <input
                type="text"
                placeholder="Username"
                value={form.username}
                onChange={(e) => {
                  setForm((f) => ({ ...f, username: e.target.value }));
                  setNoUserPrompt(false);
                }}
                maxLength={20}
                autoFocus
                className="rounded-full bg-white/10 px-4 py-2 text-white ring-1 ring-white/15 placeholder:text-white/40 focus:outline-none"
              />
              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(e) => {
                  setForm((f) => ({ ...f, password: e.target.value }));
                  setNoUserPrompt(false);
                }}
                maxLength={72}
                className="rounded-full bg-white/10 px-4 py-2 text-white ring-1 ring-white/15 placeholder:text-white/40 focus:outline-none"
              />
              <label className="flex items-center gap-2 text-white/60">
                <input
                  type="checkbox"
                  checked={form.rememberMe}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rememberMe: e.target.checked }))
                  }
                />
                Remember me
              </label>
              <button
                type="submit"
                disabled={
                  status === "submitting" || !form.username || !form.password
                }
                className="rounded-full bg-white/10 px-4 py-2 font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-40"
              >
                {status === "submitting"
                  ? "..."
                  : mode === "login"
                    ? "Log in"
                    : "Sign up"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setNoUserPrompt(false);
                }}
                className="text-center text-white/50 underline underline-offset-2 hover:text-white/80"
              >
                {mode === "login" ? "Need an account?" : "Have an account?"}
              </button>
              {status === "error" && (
                <p className="text-center text-xs text-red-300">{error}</p>
              )}
              {noUserPrompt && (
                <button
                  type="button"
                  onClick={createFromPrompt}
                  disabled={status === "submitting"}
                  className="rounded-full bg-white/10 px-4 py-2 text-center font-medium text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-40"
                >
                  Create account &quot;{form.username}&quot; with this password?
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
