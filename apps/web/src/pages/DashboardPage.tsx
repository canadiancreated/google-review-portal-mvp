export default function DashboardPage() {
  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Dashboard</h2>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8 }}>Quick Links</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>
            <a href="/reviews" style={{ color: "white" }}>
              Reviews
            </a>
          </li>
          <li>
            <a href="/alerts" style={{ color: "white" }}>
              Alerts
            </a>
          </li>
        </ul>
      </section>

      <section>
        <h2 style={{ marginBottom: 8 }}>At a glance</h2>
        <div style={{ marginBottom: 6 }}>Total Reviews: Coming soon</div>
        <div>Open Alerts: Coming soon</div>
      </section>
    </div>
  );
}
