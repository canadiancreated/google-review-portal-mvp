import { prisma } from "../db/prisma";
import { Prisma } from "../generated/prisma";

const EMPLOYEE_PROFILE_BY_NAME: Record<string, { region: string; team: string }> = {
  "Alex Carter": { region: "Calgary", team: "Install" },
  "Alex Rivera": { region: "Edmonton", team: "Install" },
  "Chris Nguyen": { region: "Calgary", team: "Service" },
  "Jamie Smith": { region: "Halifax", team: "Service" },
  "Jordan Lee": { region: "Calgary", team: "Support" },
  "Morgan Chen": { region: "Lethbridge", team: "Support" },
  "Sam Patel": { region: "Edmonton", team: "Sales" },
  "Taylor Brooks": { region: "Halifax", team: "Sales" },
};

function employeeProfile(fullName: string) {
  return EMPLOYEE_PROFILE_BY_NAME[fullName] ?? { region: "Unknown", team: "General" };
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapEmployee(employee: { id: string; fullName: string; isActive: boolean }) {
  const profile = employeeProfile(employee.fullName);
  return {
    id: employee.id,
    fullName: employee.fullName,
    region: profile.region,
    team: profile.team,
    active: employee.isActive,
    isActive: employee.isActive,
  };
}

const employeeMentionModel = (Prisma as any).dmmf.datamodel.models.find(
  (model: any) => model.name === "EmployeeMention"
);
const employeeMentionFields = new Map<string, any>(
  (employeeMentionModel?.fields ?? []).map((field: any) => [field.name, field])
);
const hasMentionField = (field: string) => employeeMentionFields.has(field);
const hasAmbiguityFlagField = hasMentionField("ambiguityFlag");
const hasDetectionMethodField = hasMentionField("detectionMethod");
const hasConfidenceScoreField = hasMentionField("confidenceScore");
const hasConfidenceField = hasMentionField("confidence");
const employeeIdNullable = Boolean(
  employeeMentionFields.get("employeeId") && employeeMentionFields.get("employeeId").isRequired === false
);
const reviewModel = (Prisma as any).dmmf.datamodel.models.find((model: any) => model.name === "Review");
const reviewFields = new Set<string>((reviewModel?.fields ?? []).map((field: any) => field.name));
const reviewVersionModel = (Prisma as any).dmmf.datamodel.models.find(
  (model: any) => model.name === "ReviewVersion"
);
const reviewVersionFields = new Set<string>((reviewVersionModel?.fields ?? []).map((field: any) => field.name));
const reviewTextField = reviewFields.has("text") ? "text" : reviewFields.has("reviewText") ? "reviewText" : "text";
const reviewerField = reviewFields.has("reviewer")
  ? "reviewer"
  : reviewFields.has("reviewerName")
    ? "reviewerName"
    : "reviewerName";
const reviewOrderField = reviewFields.has("reviewTime")
  ? "reviewTime"
  : reviewFields.has("createdAt")
    ? "createdAt"
    : "id";

function buildMentionData(input: {
  reviewId: string;
  employeeId?: string | null;
  ambiguityFlag?: boolean;
  detectionMethod?: string;
  confidenceScore?: number | null;
}) {
  const data: Record<string, unknown> = {
    reviewId: input.reviewId,
  };

  if (input.employeeId !== undefined && (input.employeeId !== null || employeeIdNullable)) {
    data.employeeId = input.employeeId;
  }
  if (hasAmbiguityFlagField && input.ambiguityFlag !== undefined) {
    data.ambiguityFlag = input.ambiguityFlag;
  }
  if (hasDetectionMethodField && input.detectionMethod !== undefined) {
    data.detectionMethod = input.detectionMethod;
  }

  if (hasConfidenceScoreField && input.confidenceScore !== undefined) {
    data.confidenceScore = input.confidenceScore;
  } else if (hasConfidenceField && input.confidenceScore !== undefined && input.confidenceScore !== null) {
    data.confidence = input.confidenceScore;
  } else if (hasConfidenceField && input.employeeId) {
    data.confidence = 1.0;
  }

  return data;
}

function databaseUrlHostPort(databaseUrl: string | undefined) {
  if (!databaseUrl) return "missing";
  try {
    const parsed = new URL(databaseUrl);
    return parsed.host || "missing";
  } catch {
    return "missing";
  }
}

export const typeDefs = /* GraphQL */ `
  type Location {
    id: ID!
    name: String!
    googlePlaceId: String!
  }

  type Review {
    reviewer: String!
    rating: Int!
    text: String!
  }

  type Alert {
    id: ID!
    type: String!
    message: String!
    createdAt: String!
  }

  type Employee {
    id: ID!
    fullName: String!
    region: String!
    team: String!
    active: Boolean!
  }

  type EmployeeMetric {
    employeeId: ID!
    fullName: String!
    mentions: Int!
    avgRating: Float!
    negativeCount: Int!
  }

  type ReviewWithMentions {
    reviewer: String!
    rating: Int!
    text: String!
    mentionedEmployees: [Employee!]!
  }

  type ReviewVersion {
    id: ID!
    reviewId: ID!
    capturedAt: String!
    rating: Int!
    text: String!
  }

  type ReviewChange {
    reviewId: ID!
    reviewer: String!
    locationName: String!
    beforeRating: Int!
    afterRating: Int!
    beforeText: String!
    afterText: String!
    changedAt: String!
  }

  type ReviewVersionDebug {
    id: ID!
    reviewId: ID!
    rating: Int!
    text: String!
    capturedAt: String!
  }

  type DbInfo {
    databaseUrlHostPort: String!
    database: String
    currentDatabase: String
    serverAddr: String
    serverPort: Int
  }

  type ReviewAmbiguity {
    reviewId: ID!
    reviewer: String!
    rating: Int!
    text: String!
    ambiguous: Boolean!
  }

  type AmbiguityDebug {
    employeeCount: Int!
    ambiguousFirstNames: [String!]!
    reviewCountChecked: Int!
    matchedReviewCount: Int!
    sampleReviewTexts: [String!]!
  }

  type Query {
    schemaFingerprint: String!
    reviews(
      locationGooglePlaceId: String
      minRating: Int
      exactRating: Int
      limit: Int
    ): [Review!]!
    locations: [Location!]!
    employees: [Employee!]!
    employeeMetrics(locationGooglePlaceId: String, minRating: Int, exactRating: Int): [EmployeeMetric!]!
    employee(id: ID!): Employee
    reviewsByEmployee(employeeId: ID!, limit: Int): [ReviewWithMentions!]!
    ambiguousReviews: [ReviewAmbiguity!]!
    ambiguityDebug: AmbiguityDebug!
    reviewChanges(limit: Int): [ReviewChange!]!
    reviewVersionsCount: Int!
    reviewVersionsSample(limit: Int): [ReviewVersionDebug!]!
    dbInfo: DbInfo!
  }

  extend type Query {
    alerts(limit: Int): [Alert!]!
  }

  type Mutation {
    attachEmployeeToReview(reviewId: ID!, employeeId: ID!): Boolean!
    removeEmployeeFromReview(reviewId: ID!, employeeId: ID!): Boolean!
  }
`;

async function computeAmbiguityData() {
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { fullName: true },
  });

  const firstNameMap = new Map<string, string[]>();
  for (const employee of employees) {
    const firstName = employee.fullName.trim().split(/\s+/)[0]?.toLowerCase();
    if (!firstName) continue;
    const group = firstNameMap.get(firstName) ?? [];
    group.push(employee.fullName);
    firstNameMap.set(firstName, group);
  }

  const ambiguousFirstNames = Array.from(firstNameMap.entries())
    .filter(([, fullNames]) => fullNames.length >= 2)
    .map(([firstName]) => firstName);

  const ambiguousGroups = ambiguousFirstNames.map((firstName) => {
    const fullNames = firstNameMap.get(firstName) ?? [];
    return {
      firstName,
      firstNameRegex: new RegExp("\\b" + escapeRegExp(firstName) + "\\b", "i"),
      fullNames,
    };
  });

  if (ambiguousGroups.length === 0) {
    return {
      employeeCount: employees.length,
      ambiguousFirstNames,
      reviewCountChecked: 0,
      matchedReviewCount: 0,
      rows: [] as Array<{ reviewId: string; reviewer: string; rating: number; text: string; ambiguous: true }>,
    };
  }

  const reviewSelect: Record<string, boolean> = {
    id: true,
    rating: true,
  };
  if (reviewFields.has("text")) reviewSelect.text = true;
  if (reviewFields.has("reviewText")) reviewSelect.reviewText = true;
  if (reviewFields.has("reviewer")) reviewSelect.reviewer = true;
  if (reviewFields.has("reviewerName")) reviewSelect.reviewerName = true;
  if (reviewFields.has("reviewTime")) reviewSelect.reviewTime = true;
  if (reviewFields.has("createdAt")) reviewSelect.createdAt = true;

  const reviews = (await prisma.review.findMany({
    orderBy: { [reviewOrderField]: "desc" } as any,
    take: 200,
    select: reviewSelect as any,
  })) as any[];

  const sampleReviewTexts = reviews.slice(0, 6).map((review) => {
    const reviewText = (review.text ?? review.reviewText ?? "").toString();
    const reviewer = (review.reviewer ?? review.reviewerName ?? "").toString();
    return `${reviewer} | ${Number(review.rating ?? 0)} | ${reviewText}`;
  });

  const rows = reviews
    .filter((review) => {
      const reviewText = (review.text ?? review.reviewText ?? "").toString();
      const textLower = reviewText.toLowerCase();
      return ambiguousGroups.some((group) => {
        if (!group.firstNameRegex.test(reviewText)) return false;
        const hasMatchingFullName = group.fullNames.some((fullName) => textLower.includes(fullName.toLowerCase()));
        return !hasMatchingFullName;
      });
    })
    .map((review) => ({
      reviewId: String(review.id),
      reviewer: (review.reviewer ?? review.reviewerName ?? "").toString(),
      rating: Number(review.rating ?? 0),
      text: (review.text ?? review.reviewText ?? "").toString(),
      ambiguous: true as const,
    }));

  return {
    employeeCount: employees.length,
    ambiguousFirstNames,
    reviewCountChecked: reviews.length,
    matchedReviewCount: rows.length,
    sampleReviewTexts,
    rows,
  };
}

type NormalizedVersionRow = {
  id: string;
  reviewId: string;
  rating: number;
  text: string;
  capturedAt: Date;
};

async function fetchNormalizedVersionRows(limit: number): Promise<NormalizedVersionRow[]> {
  const reviewVersionDelegate = (prisma as any).reviewVersion;
  if (reviewVersionDelegate) {
    const rows = (await reviewVersionDelegate.findMany({
      orderBy: { capturedAt: "desc" },
      take: limit,
    })) as any[];

    return rows.map((row) => ({
      id: String(row.id),
      reviewId: String(row.reviewId ?? row.review_id ?? ""),
      rating: Number(row.rating ?? 0),
      text: String(row.text ?? row.reviewText ?? row.review_text ?? ""),
      capturedAt: new Date(row.capturedAt ?? row.captured_at ?? row.createdAt ?? row.created_at ?? Date.now()),
    }));
  }

  const alertRows = await prisma.alertLog.findMany({
    where: { type: "review_version" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      reviewId: true,
      message: true,
      createdAt: true,
    },
  });

  return alertRows.map((row) => {
    let parsed: any = {};
    try {
      parsed = JSON.parse(row.message);
    } catch {
      parsed = {};
    }
    return {
      id: String(row.id),
      reviewId: String(row.reviewId ?? ""),
      rating: Number(parsed.rating ?? 0),
      text: String(parsed.text ?? ""),
      capturedAt: new Date(parsed.capturedAt ?? row.createdAt),
    };
  });
}

export const resolvers = {
  Query: {
    schemaFingerprint: () => "schema-fingerprint-active-001",

    reviews: async (
      _: unknown,
      args: {
        locationGooglePlaceId?: string;
        minRating?: number;
        exactRating?: number;
        limit?: number;
      }
    ) => {
      const requestedLimit = args.limit ?? 50;
      const take = Math.min(Math.max(requestedLimit, 1), 200);
      const ratingFilter =
        args.exactRating !== undefined
          ? { rating: args.exactRating }
          : args.minRating !== undefined
            ? { rating: { gte: args.minRating } }
            : {};

      const where = {
        ...ratingFilter,
        ...(args.locationGooglePlaceId
          ? { location: { googlePlaceId: args.locationGooglePlaceId } }
          : {}),
      };

      const rows = await prisma.review.findMany({
        where,
        orderBy: { reviewTime: "desc" },
        take,
        select: {
          reviewerName: true,
          rating: true,
          text: true,
        },
      });

      return rows.map((row) => ({
        reviewer: row.reviewerName,
        rating: row.rating,
        text: row.text,
      }));
    },

    locations: async () => {
      const rows = await prisma.location.findMany({
        select: {
          id: true,
          name: true,
          googlePlaceId: true,
        },
      });

      const seen = new Set<string>();
      const unique = rows.filter((row) => {
        if (!row.googlePlaceId) return false;
        if (seen.has(row.googlePlaceId)) return false;
        seen.add(row.googlePlaceId);
        return true;
      });

      return unique
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((row) => ({
          id: row.id,
          name: row.name,
          googlePlaceId: row.googlePlaceId as string,
        }));
    },

    alerts: async (_: unknown, args: { limit?: number }) => {
      const requestedLimit = args.limit ?? 50;
      const take = Math.min(Math.max(requestedLimit, 1), 200);

      const rows = await prisma.alertLog.findMany({
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          type: true,
          message: true,
          createdAt: true,
        },
      });

      return rows.map((row) => ({
        id: row.id,
        type: row.type,
        message: row.message,
        createdAt: row.createdAt.toISOString(),
      }));
    },

    employees: async () => {
      const rows = await prisma.employee.findMany({
        where: { isActive: true },
        orderBy: { fullName: "asc" },
        select: {
          id: true,
          fullName: true,
          isActive: true,
        },
      });

      return rows.map(mapEmployee);
    },

    employee: async (_: unknown, args: { id: string }) => {
      const row = await prisma.employee.findUnique({
        where: { id: args.id },
        select: {
          id: true,
          fullName: true,
          isActive: true,
        },
      });

      return row ? mapEmployee(row) : null;
    },

    employeeMetrics: async (
      _: unknown,
      args: { locationGooglePlaceId?: string; minRating?: number; exactRating?: number }
    ) => {
      const ratingFilter =
        args.exactRating !== undefined
          ? { rating: args.exactRating }
          : args.minRating !== undefined
            ? { rating: { gte: args.minRating } }
            : {};

      const reviewWhere = {
        ...ratingFilter,
        ...(args.locationGooglePlaceId
          ? { location: { googlePlaceId: args.locationGooglePlaceId } }
          : {}),
      };

      const [activeEmployees, mentionRows] = await Promise.all([
        prisma.employee.findMany({
          where: { isActive: true },
          orderBy: { fullName: "asc" },
          select: { id: true, fullName: true, isActive: true },
        }),
        prisma.employeeMention.findMany({
          where: {
            review: reviewWhere,
            employee: { isActive: true },
          },
          select: {
            employeeId: true,
            review: {
              select: {
                rating: true,
              },
            },
          },
        }),
      ]);

      const metrics = new Map<
        string,
        { employeeId: string; fullName: string; mentions: number; sumRating: number; negativeCount: number }
      >();

      for (const employee of activeEmployees) {
        metrics.set(employee.id, {
          employeeId: employee.id,
          fullName: employee.fullName,
          mentions: 0,
          sumRating: 0,
          negativeCount: 0,
        });
      }

      for (const row of mentionRows) {
        const metric = metrics.get(row.employeeId);
        if (!metric) continue;
        metric.mentions += 1;
        metric.sumRating += row.review.rating;
        if (row.review.rating <= 2) {
          metric.negativeCount += 1;
        }
      }

      return Array.from(metrics.values())
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .map((metric) => ({
          employeeId: metric.employeeId,
          fullName: metric.fullName,
          mentions: metric.mentions,
          avgRating: metric.mentions > 0 ? metric.sumRating / metric.mentions : 0,
          negativeCount: metric.negativeCount,
        }));
    },

    reviewsByEmployee: async (_: unknown, args: { employeeId: string; limit?: number }) => {
      const requestedLimit = args.limit ?? 50;
      const take = Math.min(Math.max(requestedLimit, 1), 200);

      const rows = await prisma.employeeMention.findMany({
        where: { employeeId: args.employeeId },
        select: {
          review: {
            select: {
              id: true,
              reviewerName: true,
              rating: true,
              text: true,
              reviewTime: true,
              mentions: {
                select: {
                  employee: {
                    select: {
                      id: true,
                      fullName: true,
                      isActive: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return rows
        .map((row) => row.review)
        .sort((a, b) => b.reviewTime.getTime() - a.reviewTime.getTime())
        .slice(0, take)
        .map((review) => ({
          reviewer: review.reviewerName,
          rating: review.rating,
          text: review.text,
          mentionedEmployees: review.mentions.map((mention) => mapEmployee(mention.employee)),
        }));
    },

    ambiguousReviews: async () => {
      const result = await computeAmbiguityData();
      return result.rows;
    },

    ambiguityDebug: async () => {
      const result = await computeAmbiguityData();
      return {
        employeeCount: result.employeeCount,
        ambiguousFirstNames: result.ambiguousFirstNames,
        reviewCountChecked: result.reviewCountChecked,
        matchedReviewCount: result.matchedReviewCount,
        sampleReviewTexts: result.sampleReviewTexts,
      };
    },

    reviewChanges: async (_: unknown, args: { limit?: number }) => {
      const requestedLimit = args.limit ?? 50;
      const take = Math.min(Math.max(requestedLimit, 1), 200);
      const versions = await fetchNormalizedVersionRows(500);
      const grouped = new Map<string, NormalizedVersionRow[]>();
      for (const row of versions) {
        if (!row.reviewId) continue;
        const current = grouped.get(row.reviewId) ?? [];
        current.push(row);
        grouped.set(row.reviewId, current);
      }

      const changes: Array<{
        reviewId: string;
        reviewer: string;
        locationName: string;
        beforeRating: number;
        afterRating: number;
        beforeText: string;
        afterText: string;
        changedAt: string;
        changedAtMs: number;
      }> = [];

      for (const [reviewId, reviewVersions] of grouped) {
        const sorted = reviewVersions
          .slice()
          .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
        if (sorted.length < 2) continue;
        const after = sorted[0];
        const before = sorted[1];
        if (before.rating === after.rating && before.text === after.text) continue;

        changes.push({
          reviewId,
          reviewer: "",
          locationName: "",
          beforeRating: before.rating,
          afterRating: after.rating,
          beforeText: before.text,
          afterText: after.text,
          changedAt: after.capturedAt.toISOString(),
          changedAtMs: after.capturedAt.getTime(),
        });
      }

      const reviewIds = changes.map((change) => change.reviewId);
      const reviewRows = await prisma.review.findMany({
        where: { id: { in: reviewIds } },
        include: { location: true },
      });
      const reviewMap = new Map<string, any>(reviewRows.map((row) => [row.id, row]));

      for (const change of changes) {
        const review = reviewMap.get(change.reviewId);
        change.reviewer = String((review as any)?.reviewer ?? (review as any)?.reviewerName ?? "");
        change.locationName = String((review as any)?.location?.name ?? "");
      }

      return changes
        .sort((a, b) => b.changedAtMs - a.changedAtMs)
        .slice(0, take)
        .map(({ changedAtMs, ...rest }) => rest);
    },

    reviewVersionsCount: async () => {
      try {
        const rv = (prisma as any).reviewVersion ?? (prisma as any).reviewVersions;
        if (!rv) {
          console.error("Missing reviewVersion delegate");
          return 0;
        }
        const count = await rv.count();
        console.log("[reviewVersionsCount] count=", count);
        return count;
      } catch (err) {
        console.error("[reviewVersionsCount] error", err);
        return 0;
      }
    },

    reviewVersionsSample: async (_: unknown, args: { limit?: number }) => {
      try {
        const requestedLimit = args.limit ?? 10;
        const take = Math.min(Math.max(requestedLimit, 1), 50);
        const reviewVersionDelegate = (prisma as any).reviewVersion;

        if (reviewVersionDelegate) {
          const orderBy = reviewVersionFields.has("capturedAt")
            ? { capturedAt: "desc" }
            : reviewVersionFields.has("createdAt")
              ? { createdAt: "desc" }
              : { id: "desc" };
          const rows = (await reviewVersionDelegate.findMany({
            take,
            orderBy,
          })) as any[];
          console.log("[reviewVersionsSample] rows=", rows.length);
          return rows.map((version) => {
            const capturedAt = new Date(version.capturedAt ?? version.createdAt ?? Date.now());
            return {
              id: String(version.id),
              reviewId: String(version.reviewId ?? ""),
              rating: Number(version.rating ?? 0),
              text: String(version.text ?? version.reviewText ?? ""),
              capturedAt: capturedAt.toISOString(),
            };
          });
        }

        const rows = await prisma.alertLog.findMany({
          where: { type: "review_version" },
          take,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            reviewId: true,
            message: true,
            createdAt: true,
          },
        });
        console.log("[reviewVersionsSample] rows=", rows.length);
        return rows.map((version) => {
          let parsed: any = {};
          try {
            parsed = JSON.parse(version.message);
          } catch {
            parsed = {};
          }
          const capturedAt = new Date(parsed.capturedAt ?? version.createdAt);
          return {
            id: String(version.id),
            reviewId: String(version.reviewId ?? ""),
            rating: Number(parsed.rating ?? 0),
            text: String(parsed.text ?? parsed.reviewText ?? ""),
            capturedAt: capturedAt.toISOString(),
          };
        });
      } catch (err) {
        console.error("[reviewVersionsSample] error", err);
        return [];
      }
    },

    dbInfo: async () => {
      const hostPort = databaseUrlHostPort(process.env.DATABASE_URL);
      try {
        const rows = (await prisma.$queryRaw<
          Array<{ db: string; addr: string | null; port: number | null }>
        >`SELECT current_database() as db, inet_server_addr() as addr, inet_server_port() as port`) as Array<{
          db: string;
          addr: string | null;
          port: number | null;
        }>;
        const identity = rows[0] ?? { db: null, addr: null, port: null };
        return {
          databaseUrlHostPort: hostPort,
          database: identity.db,
          currentDatabase: identity.db,
          serverAddr: identity.addr,
          serverPort: identity.port,
        };
      } catch (err) {
        console.error("[dbInfo] error", err);
        return {
          databaseUrlHostPort: hostPort,
          database: null,
          currentDatabase: null,
          serverAddr: null,
          serverPort: null,
        };
      }
    },
  },

  Mutation: {
    attachEmployeeToReview: async (_: unknown, args: { reviewId: string; employeeId: string }) => {
      if (hasAmbiguityFlagField) {
        await prisma.employeeMention.deleteMany({
          where: {
            reviewId: args.reviewId,
            ambiguityFlag: true,
          } as any,
        });
      } else if (employeeIdNullable) {
        await prisma.employeeMention.deleteMany({
          where: {
            reviewId: args.reviewId,
            employeeId: null,
          } as any,
        });
      }

      const existing = await prisma.employeeMention.findFirst({
        where: {
          reviewId: args.reviewId,
          employeeId: args.employeeId,
        },
      });

      if (!existing) {
        await prisma.employeeMention.create({
          data: buildMentionData({
            reviewId: args.reviewId,
            employeeId: args.employeeId,
            detectionMethod: "manual",
            ambiguityFlag: false,
            confidenceScore: 1.0,
          }) as any,
        });
      }

      return true;
    },

    removeEmployeeFromReview: async (_: unknown, args: { reviewId: string; employeeId: string }) => {
      await prisma.employeeMention.deleteMany({
        where: {
          reviewId: args.reviewId,
          employeeId: args.employeeId,
        },
      });
      return true;
    },
  },

  Employee: {
    region: (employee: { fullName: string }) => employeeProfile(employee.fullName).region,
    team: (employee: { fullName: string }) => employeeProfile(employee.fullName).team,
    active: (employee: { active?: boolean; isActive?: boolean }) =>
      employee.active ?? employee.isActive ?? true,
  },
};
