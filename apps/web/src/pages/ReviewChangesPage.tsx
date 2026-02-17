import { useQuery } from "urql";

type ReviewChangeRow = {
  reviewer: string;
  locationName: string;
  beforeRating: number;
  afterRating: number;
  beforeText: string;
  afterText: string;
  changedAt: string;
};

type ReviewChangesQueryData = {
  reviewChanges: ReviewChangeRow[];
};

const REVIEW_CHANGES_QUERY = `
  query {
    reviewChanges(limit: 50) {
      reviewer
      locationName
      beforeRating
      afterRating
      beforeText
      afterText
      changedAt
    }
  }
`;

export default function ReviewChangesPage() {
  const [{ data, fetching, error }] = useQuery<ReviewChangesQueryData>({
    query: REVIEW_CHANGES_QUERY,
  });

  if (fetching) {
    return <div>Loading review changes...</div>;
  }

  if (error) {
    return (
      <div>
        <strong>Review changes error:</strong> {error.message}
      </div>
    );
  }

  const rows = data?.reviewChanges ?? [];

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Review Changes</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>Reviewer</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>Location</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>Rating</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>Text</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>ChangedAt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.reviewer}-${row.changedAt}-${index}`}>
              <td style={{ padding: 8, borderBottom: "1px solid #333" }}>{row.reviewer}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #333" }}>{row.locationName}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #333" }}>
                {row.beforeRating} -&gt; {row.afterRating}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #333" }}>
                <div style={{ marginBottom: 4 }}>
                  <strong>Before:</strong> {row.beforeText}
                </div>
                <div>
                  <strong>After:</strong> {row.afterText}
                </div>
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #333" }}>{row.changedAt}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: 8 }}>
                No review changes found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
