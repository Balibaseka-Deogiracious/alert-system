"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut, Moon, Sun, UserRound } from "lucide-react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("unialert-theme") as Theme | null;
    if (storedTheme === "dark" || storedTheme === "light") setTheme(storedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("unialert-theme", theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark") }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const context = useContext(ThemeContext);
  if (!context) return null;

  const isDark = context.theme === "dark";
  return (
    <button className="theme-toggle" type="button" onClick={context.toggleTheme} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={isDark}>
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
      <span>{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}

export function AdminThemeToggle() {
  const pathname = usePathname();
  if (pathname !== "/admin") return null;
  return <div className="admin-theme-toggle"><ThemeToggle /></div>;
}

export function ProfileDropdown({ name, initials, role, summary, email }: { name: string; initials: string; role: string; summary: string; email: string }) {
  const [open, setOpen] = useState(false);

  function handleLogout() {
    window.localStorage.removeItem("unialert-session");
    window.location.assign("/");
  }

  return <div className="profile-menu">
    <button className="profile-trigger" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="menu">
      <span className="profile-avatar">{initials}</span><span className="profile-trigger-copy"><b>{name}</b><small>{role}</small></span><span className="profile-caret">{open ? "▲" : "▼"}</span>
    </button>
    {open && <div className="profile-dropdown" role="menu">
      <div className="profile-summary"><span className="profile-summary-icon"><UserRound size={16} /></span><span><b>{name}</b><small>{summary}</small><small>{email}</small></span></div>
      <button className="profile-logout" type="button" role="menuitem" onClick={handleLogout}><LogOut size={15} /> Logout</button>
    </div>}
  </div>;
}