import { useState, useRef, useEffect } from "react";
import { LogOut, User, ChevronDown } from "lucide-react";

export default function UserMenu({ user, roleLabel, onLogout, extraOptions = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div style={{ position: "relative" }} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: "var(--gray-100)",
          border: "1px solid var(--gray-200)",
          borderRadius: "50%",
          width: "36px",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
          color: "var(--gray-600)",
          transition: "all 0.2s"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--gray-200)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--gray-100)";
        }}
      >
        <User size={18} />
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid var(--gray-200)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
            width: "220px",
            zIndex: 9999,
            overflow: "hidden"
          }}
        >
          {/* Header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--gray-100)" }}>
            <div style={{ fontWeight: 700, color: "var(--gray-800)", fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.nombre_completo || "Usuario"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--gray-500)", marginTop: "2px", fontWeight: 500 }}>
              {roleLabel}
            </div>
          </div>

          {/* Options */}
          <div style={{ padding: "8px 4px 4px 4px" }}>
            {extraOptions.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => {
                  opt.onClick();
                  setIsOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  background: opt.active ? "var(--gray-100)" : "transparent",
                  color: opt.active ? "var(--gray-900)" : "var(--gray-600)",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: opt.active ? 600 : 500,
                  textAlign: "left"
                }}
                onMouseEnter={(e) => {
                  if (!opt.active) e.currentTarget.style.background = "var(--gray-50)";
                }}
                onMouseLeave={(e) => {
                  if (!opt.active) e.currentTarget.style.background = "transparent";
                }}
              >
                {opt.icon && <opt.icon size={16} />}
                {opt.label}
              </button>
            ))}

            {extraOptions.length > 0 && <div style={{ height: "1px", background: "var(--gray-100)", margin: "4px 0" }} />}

            {/* Logout */}
            <button
              onClick={() => {
                onLogout();
                setIsOpen(false);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: "transparent",
                color: "var(--danger)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 600,
                textAlign: "left"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <LogOut size={16} /> Salir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
