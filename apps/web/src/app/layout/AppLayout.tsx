import type { ReactNode } from "react";

type AppLayoutProps = {
  children: ReactNode;
};

function Outlet({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div style={{ padding: 24, color: "white" }}>
      <h1 style={{ marginBottom: 16, fontSize: 36 }}>Google Review Portal</h1>

      <nav style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <a href="/" style={{ color: "white" }}>
          Dashboard
        </a>
        <a href="/reviews" style={{ color: "white" }}>
          Reviews
        </a>
        <a href="/alerts" style={{ color: "white" }}>
          Alerts
        </a>
        <a href="/changes" style={{ color: "white" }}>
          Review Changes
        </a>
        <a href="/employees" style={{ color: "white" }}>
          Employees
        </a>
      </nav>

      <main>
        <Outlet>{children}</Outlet>
      </main>
    </div>
  );
}
