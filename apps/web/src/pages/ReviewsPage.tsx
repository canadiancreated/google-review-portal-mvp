import { useMemo, useState } from "react";
import { useQuery } from "urql";

type LocationRow = {
  id: string;
  name: string;
  googlePlaceId: string;
};

type ReviewRow = {
  reviewer: string;
  rating: number;
  text: string;
};

type ReviewAmbiguityRow = {
  reviewId: string;
  reviewer: string;
  rating: number;
  text: string;
  ambiguous: boolean;
};

type LocationsQueryData = {
  locations: LocationRow[];
};

type ReviewsQueryData = {
  reviews: ReviewRow[];
};

type AmbiguousReviewsQueryData = {
  ambiguousReviews: ReviewAmbiguityRow[];
};

type ReviewsQueryVars = {
  locationGooglePlaceId?: string;
  minRating?: number;
  exactRating?: number;
  limit: number;
};

const LOCATIONS_QUERY = `
  query {
    locations {
      id
      name
      googlePlaceId
    }
  }
`;

const REVIEWS_QUERY = `
  query Reviews($locationGooglePlaceId: String, $minRating: Int, $exactRating: Int, $limit: Int) {
    reviews(
      locationGooglePlaceId: $locationGooglePlaceId
      minRating: $minRating
      exactRating: $exactRating
      limit: $limit
    ) {
      reviewer
      rating
      text
    }
  }
`;

const AMBIGUOUS_REVIEWS_QUERY = `
  query {
    ambiguousReviews {
      reviewId
      reviewer
      rating
      text
      ambiguous
    }
  }
`;

const RATING_FILTER_OPTIONS: Array<{
  label: string;
  value: "" | "5" | "5+" | "4" | "4+" | "3" | "3+" | "2" | "2+" | "1" | "1+";
}> = [
  { label: "All ratings", value: "" },
  { label: "5 only", value: "5" },
  { label: "5+", value: "5+" },
  { label: "4 only", value: "4" },
  { label: "4+", value: "4+" },
  { label: "3 only", value: "3" },
  { label: "3+", value: "3+" },
  { label: "2 only", value: "2" },
  { label: "2+", value: "2+" },
  { label: "1 only", value: "1" },
  { label: "1+", value: "1+" },
];

export default function ReviewsPage() {
  const [locationGooglePlaceId, setLocationGooglePlaceId] = useState("");
  const [ratingFilterValue, setRatingFilterValue] = useState<
    "" | "5" | "5+" | "4" | "4+" | "3" | "3+" | "2" | "2+" | "1" | "1+"
  >("");

  const [{ data: locationsData, fetching: locationsLoading, error: locationsError }] = useQuery<LocationsQueryData>({
    query: LOCATIONS_QUERY,
  });

  const reviewsVariables = useMemo<ReviewsQueryVars>(() => {
    let minRating: number | undefined;
    let exactRating: number | undefined;

    if (ratingFilterValue.endsWith("+")) {
      minRating = Number(ratingFilterValue.slice(0, -1));
    } else if (ratingFilterValue) {
      exactRating = Number(ratingFilterValue);
    }

    return {
      locationGooglePlaceId: locationGooglePlaceId || undefined,
      minRating: Number.isFinite(minRating) ? minRating : undefined,
      exactRating: Number.isFinite(exactRating) ? exactRating : undefined,
      limit: 50,
    };
  }, [locationGooglePlaceId, ratingFilterValue]);

  const [{ data: reviewsData, fetching: reviewsLoading, error: reviewsError }] = useQuery<
    ReviewsQueryData,
    ReviewsQueryVars
  >({
    query: REVIEWS_QUERY,
    variables: reviewsVariables,
  });
  const [{ data: ambiguousData, fetching: ambiguousLoading, error: ambiguousError }] =
    useQuery<AmbiguousReviewsQueryData>({
      query: AMBIGUOUS_REVIEWS_QUERY,
    });
  const ambiguousLookup = useMemo(() => {
    const set = new Set<string>();
    for (const row of ambiguousData?.ambiguousReviews ?? []) {
      if (!row.ambiguous) continue;
      set.add(`${row.reviewer}||${row.rating}||${row.text}`);
    }
    return set;
  }, [ambiguousData]);

  return (
    <div style={{ padding: 24, color: "white" }}>
      <h1 style={{ marginBottom: 16 }}>Reviews</h1>

      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span>Location</span>
          <select
            value={locationGooglePlaceId}
            onChange={(event) => setLocationGooglePlaceId(event.target.value)}
          >
            <option value="">All locations</option>
            {(locationsData?.locations ?? []).map((location) => (
              <option key={location.id} value={location.googlePlaceId}>
                {location.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span>Sort Rating</span>
          <select
            value={ratingFilterValue}
            onChange={(event) =>
              setRatingFilterValue(
                event.target.value as "" | "5" | "5+" | "4" | "4+" | "3" | "3+" | "2" | "2+" | "1" | "1+"
              )
            }
          >
            {RATING_FILTER_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {locationsLoading ? <div style={{ marginBottom: 12 }}>Loading locations...</div> : null}
      {locationsError ? (
        <div style={{ marginBottom: 12 }}>
          <strong>Locations error:</strong> {locationsError.message}
        </div>
      ) : null}

      {reviewsLoading ? <div>Loading reviews...</div> : null}
      {reviewsError ? (
        <div>
          <strong>Reviews error:</strong> {reviewsError.message}
        </div>
      ) : null}
      {ambiguousLoading ? <div>Loading ambiguity info...</div> : null}
      {ambiguousError ? (
        <div>
          <strong>Ambiguity error:</strong> {ambiguousError.message}
        </div>
      ) : null}

      {!reviewsLoading && !reviewsError ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>Reviewer</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555", width: 80 }}>Rating</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #555" }}>Review</th>
            </tr>
          </thead>
          <tbody>
            {(reviewsData?.reviews ?? []).map((review, idx) => {
              const rowKey = `${review.reviewer}||${review.rating}||${review.text}`;
              const isAmbiguous = ambiguousLookup.has(rowKey);
              return (
              <tr key={`${review.reviewer}-${idx}`}>
                <td style={{ padding: 8, borderBottom: "1px solid #333" }}>{review.reviewer}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #333" }}>{review.rating}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #333" }}>
                  {review.text}
                  {isAmbiguous ? (
                    <span style={{ marginLeft: 8, fontSize: 12, border: "1px solid #888", padding: "1px 6px" }}>
                      Ambiguous mention
                    </span>
                  ) : null}
                </td>
              </tr>
            )})}
            {(reviewsData?.reviews ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: 8 }}>
                  No reviews found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
