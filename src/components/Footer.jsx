export default function Footer({ simple = false }) {
  return (
    <div
      style={{
        fontSize: "11px",
        color: "var(--gray-400)",
        textAlign: "center",
        marginTop: "2rem",
        paddingBottom: "1.5rem",
        lineHeight: "1.6",
        opacity: 0.8,
      }}
    >
      <div>
        Copyright &copy; {new Date().getFullYear()}{" "}
        <a
          href="./"
          style={{
            color: "var(--gray-600)",
            textDecoration: "none",
            fontWeight: "700",
          }}
        >
          Adese
        </a>{" "}
        v2.0
      </div>
      {!simple && (
        <div style={{ marginTop: "4px", fontSize: "10px", opacity: 0.7 }}>
          Desarrollado por {" "}
          <a
            href="https://alan.arahocorp.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--primary)",
              fontWeight: "600",
              textDecoration: "none",
            }}
          >
            Alan
          </a>
        </div>
      )}
    </div>
  );
}
