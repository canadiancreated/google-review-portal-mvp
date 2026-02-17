import { useEffect, useState } from "react";
import { useQuery } from "urql";
import "./App.css";
import { resolveRoute } from "./app/router";

const REVIEWS_QUERY = `
  query {
    health
    reviews {
      reviewer
      rating
      text
    }
  }
`;

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const routedPage = resolveRoute(pathname);
  const [{ data, fetching, error }] = useQuery({ query: REVIEWS_QUERY });

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (routedPage) {
    return routedPage;
  }

  if (fetching) {
    return (
      <div style={{ padding: 24, color: "white" }}>
        Loading from GraphQL...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: "white" }}>
        <div style={{ marginBottom: 12 }}>GraphQL error:</div>
        <pre>{error.message}</pre>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, color: "white" }}>
      <h1 style={{ marginBottom: 8 }}>Google Review Portal</h1>
      <div style={{ marginBottom: 24 }}>Health: {data.health}</div>

      <h2 style={{ marginBottom: 8 }}>Reviews</h2>
      <ul>
        {data.reviews.map((r: any, idx: number) => (
          <li key={idx} style={{ marginBottom: 12 }}>
            <strong>{r.reviewer}</strong> ({r.rating})<br />
            {r.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
