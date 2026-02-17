import { useQuery } from "urql";

type EmployeeDetailPageProps = {
  employeeId: string;
};

type EmployeeData = {
  id: string;
  fullName: string;
  region: string;
  team: string;
  active: boolean;
};

type ReviewWithMentions = {
  reviewer: string;
  rating: number;
  text: string;
  mentionedEmployees: Array<{
    id: string;
    fullName: string;
  }>;
};

type EmployeeQueryData = {
  employee: EmployeeData | null;
};

type ReviewsByEmployeeQueryData = {
  reviewsByEmployee: ReviewWithMentions[];
};

const EMPLOYEE_QUERY = `
  query Employee($id: ID!) {
    employee(id: $id) {
      id
      fullName
      region
      team
      active
    }
  }
`;

const REVIEWS_BY_EMPLOYEE_QUERY = `
  query ReviewsByEmployee($employeeId: ID!) {
    reviewsByEmployee(employeeId: $employeeId, limit: 50) {
      reviewer
      rating
      text
      mentionedEmployees {
        id
        fullName
      }
    }
  }
`;

export default function EmployeeDetailPage({ employeeId }: EmployeeDetailPageProps) {
  const [{ data: employeeData, fetching: employeeLoading, error: employeeError }] = useQuery<
    EmployeeQueryData,
    { id: string }
  >({
    query: EMPLOYEE_QUERY,
    variables: { id: employeeId },
  });

  const [{ data: reviewsData, fetching: reviewsLoading, error: reviewsError }] = useQuery<
    ReviewsByEmployeeQueryData,
    { employeeId: string }
  >({
    query: REVIEWS_BY_EMPLOYEE_QUERY,
    variables: { employeeId },
  });

  if (employeeLoading || reviewsLoading) {
    return <div>Loading employee details...</div>;
  }

  if (employeeError) {
    return (
      <div>
        <strong>Employee error:</strong> {employeeError.message}
      </div>
    );
  }

  if (reviewsError) {
    return (
      <div>
        <strong>Reviews error:</strong> {reviewsError.message}
      </div>
    );
  }

  const employee = employeeData?.employee;
  const reviews = reviewsData?.reviewsByEmployee ?? [];

  if (!employee) {
    return <div>Employee not found.</div>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: 8 }}>{employee.fullName}</h2>
      <div style={{ marginBottom: 4 }}>Region: {employee.region}</div>
      <div style={{ marginBottom: 16 }}>Team: {employee.team}</div>

      <h3 style={{ marginBottom: 8 }}>Reviews mentioning this employee</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>Reviewer</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>Rating</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>Review</th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((review, index) => (
            <tr key={`${review.reviewer}-${index}`}>
              <td style={{ padding: 8, borderBottom: "1px solid #333" }}>{review.reviewer}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #333" }}>{review.rating}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #333" }}>{review.text}</td>
            </tr>
          ))}
          {reviews.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ padding: 8 }}>
                No reviews found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
