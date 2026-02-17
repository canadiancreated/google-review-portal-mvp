import { useQuery } from "urql";

type EmployeeMetric = {
  employeeId: string;
  fullName: string;
  mentions: number;
  avgRating: number;
  negativeCount: number;
};

type EmployeeMetricsQueryData = {
  employeeMetrics: EmployeeMetric[];
};

const EMPLOYEE_METRICS_QUERY = `
  query {
    employeeMetrics {
      employeeId
      fullName
      mentions
      avgRating
      negativeCount
    }
  }
`;

export default function EmployeesPage() {
  const [{ data, fetching, error }] = useQuery<EmployeeMetricsQueryData>({
    query: EMPLOYEE_METRICS_QUERY,
  });

  if (fetching) {
    return <div>Loading employee metrics...</div>;
  }

  if (error) {
    return (
      <div>
        <strong>Employee metrics error:</strong> {error.message}
      </div>
    );
  }

  const rows = data?.employeeMetrics ?? [];

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Employees</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>Employee</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>Mentions</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>Avg Rating</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>1-2 Star Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.employeeId}>
              <td style={{ padding: 8, borderBottom: "1px solid #333" }}>
                <a href={`/employees/${row.employeeId}`} style={{ color: "white" }}>
                  {row.fullName}
                </a>
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #333" }}>{row.mentions}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #333" }}>{row.avgRating.toFixed(1)}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #333" }}>{row.negativeCount}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: 8 }}>
                No employees found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
