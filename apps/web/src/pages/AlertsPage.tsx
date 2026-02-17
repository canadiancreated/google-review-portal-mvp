import { useQuery } from "urql";

type AlertRow = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

type AlertsQueryData = {
  alerts: AlertRow[];
};

type AlertsQueryVars = {
  limit: number;
};

const ALERTS_QUERY = `
  query Alerts($limit: Int) {
    alerts(limit: $limit) {
      id
      type
      message
      createdAt
    }
  }
`;

export default function AlertsPage() {
  const [{ data, fetching, error }] = useQuery<AlertsQueryData, AlertsQueryVars>({
    query: ALERTS_QUERY,
    variables: { limit: 50 },
  });

  if (fetching) {
    return <div>Loading alerts...</div>;
  }

  if (error) {
    return (
      <div>
        <strong>Alerts error:</strong> {error.message}
      </div>
    );
  }

  const alerts = data?.alerts ?? [];

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Alerts</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>Type</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>Message</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <tr key={alert.id}>
              <td style={{ padding: 8, borderBottom: "1px solid #333" }}>{alert.type}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #333" }}>{alert.message}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #333" }}>{alert.createdAt}</td>
            </tr>
          ))}
          {alerts.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ padding: 8 }}>
                No alerts found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
