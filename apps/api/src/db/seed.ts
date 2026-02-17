import { prisma } from "./prisma";
import { Prisma } from "../generated/prisma";

type SeedLocation = {
  name: string;
  googlePlaceId: string;
  reviews: Array<{
    googleReviewId: string;
    reviewerName: string;
    rating: number;
    text: string;
    reviewTime: Date;
  }>;
};

type SeedEmployee = {
  fullName: string;
  region: string;
  team: string;
  active: boolean;
};

const isDryRun = process.argv.includes("--dry");

const seedData: SeedLocation[] = [
  {
    name: "Firefly Solar Calgary",
    googlePlaceId: "seed_firefly_calgary",
    reviews: [
      {
        googleReviewId: "seed_review_calgary_001",
        reviewerName: "Maya Thompson",
        rating: 5,
        text: "Excellent install experience. Chris Nguyen and Jordan Lee were very helpful.",
        reviewTime: new Date("2025-11-05T10:00:00.000Z"),
      },
      {
        googleReviewId: "seed_review_calgary_002",
        reviewerName: "Ethan Brooks",
        rating: 2,
        text: "Alex was helpful, but communication could improve.",
        reviewTime: new Date("2025-11-07T15:30:00.000Z"),
      },
      {
        googleReviewId: "seed_review_calgary_003",
        reviewerName: "Olivia Chen",
        rating: 4,
        text: "Team was professional and the final setup looks great. Alex Carter handled the install.",
        reviewTime: new Date("2025-11-09T12:15:00.000Z"),
      },
    ],
  },
  {
    name: "Firefly Solar Edmonton",
    googlePlaceId: "seed_firefly_edmonton",
    reviews: [
      {
        googleReviewId: "seed_review_edmonton_001",
        reviewerName: "Noah Singh",
        rating: 1,
        text: "Support response was too slow after installation. Sam Patel eventually helped.",
        reviewTime: new Date("2025-11-08T09:20:00.000Z"),
      },
      {
        googleReviewId: "seed_review_edmonton_002",
        reviewerName: "Ava Martin",
        rating: 5,
        text: "Great service from quote to final inspection. Taylor was great.",
        reviewTime: new Date("2025-11-10T17:45:00.000Z"),
      },
      {
        googleReviewId: "seed_review_edmonton_003",
        reviewerName: "Liam Garcia",
        rating: 3,
        text: "Good outcome overall, but communication could improve. Alex Rivera and Jamie were responsive.",
        reviewTime: new Date("2025-11-12T14:10:00.000Z"),
      },
    ],
  },
  {
    name: "Firefly Solar Lethbridge",
    googlePlaceId: "seed_firefly_lethbridge",
    reviews: [],
  },
  {
    name: "Firefly Solar Halifax",
    googlePlaceId: "seed_firefly_halifax",
    reviews: [],
  },
];

const seedEmployees: SeedEmployee[] = [
  { fullName: "Alex Carter", region: "Calgary", team: "Install", active: true },
  { fullName: "Alex Rivera", region: "Edmonton", team: "Install", active: true },
  { fullName: "Alex Johnson", region: "Calgary", team: "Install", active: true },
  { fullName: "Alex Smith", region: "Edmonton", team: "Install", active: true },
  { fullName: "Chris Nguyen", region: "Calgary", team: "Service", active: true },
  { fullName: "Jamie Smith", region: "Halifax", team: "Service", active: true },
  { fullName: "Jordan Lee", region: "Calgary", team: "Support", active: true },
  { fullName: "Morgan Chen", region: "Lethbridge", team: "Support", active: true },
  { fullName: "Sam Patel", region: "Edmonton", team: "Sales", active: true },
  { fullName: "Taylor Brooks", region: "Halifax", team: "Sales", active: true },
];

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  const map = new Map<string, T>();
  for (const row of rows) {
    map.set(row.id, row);
  }
  return Array.from(map.values());
}

type MentionDetectionResult =
  | { type: "resolved"; employees: Array<{ id: string; fullName: string }> }
  | { type: "ambiguous"; employees: Array<{ id: string; fullName: string }> }
  | { type: "none"; employees: [] };

function detectMentionedEmployees(
  text: string,
  employees: Array<{ id: string; fullName: string }>
): MentionDetectionResult {
  const fullNameMatches = employees.filter((employee) =>
    new RegExp(`\\b${escapeRegExp(employee.fullName)}\\b`, "i").test(text)
  );

  if (fullNameMatches.length > 0) {
    return { type: "resolved", employees: uniqueById(fullNameMatches) };
  }

  const firstNameToEmployees = new Map<string, Array<{ id: string; fullName: string }>>();
  for (const employee of employees) {
    const firstName = employee.fullName.trim().split(/\s+/)[0]?.toLowerCase();
    if (!firstName) continue;
    const current = firstNameToEmployees.get(firstName) ?? [];
    current.push(employee);
    firstNameToEmployees.set(firstName, current);
  }

  const firstNamesInText: string[] = [];
  for (const firstName of firstNameToEmployees.keys()) {
    if (new RegExp(`\\b${escapeRegExp(firstName)}\\b`, "i").test(text)) {
      firstNamesInText.push(firstName);
    }
  }

  if (firstNamesInText.length === 0) {
    return { type: "none", employees: [] };
  }

  for (const firstName of firstNamesInText) {
    const candidates = firstNameToEmployees.get(firstName) ?? [];
    if (candidates.length !== 1) {
      return { type: "ambiguous", employees: uniqueById(candidates) };
    }
  }

  const selected = firstNamesInText
    .map((firstName) => (firstNameToEmployees.get(firstName) ?? [])[0])
    .filter((row): row is { id: string; fullName: string } => Boolean(row));

  return { type: "resolved", employees: uniqueById(selected) };
}

function printDryRunPlan() {
  const summary = seedData.map((location) => ({
    location: {
      name: location.name,
      googlePlaceId: location.googlePlaceId,
    },
    reviews: location.reviews.map((review) => ({
      googleReviewId: review.googleReviewId,
      reviewer: review.reviewerName,
      rating: review.rating,
      text: review.text,
      reviewTime: review.reviewTime.toISOString(),
    })),
  }));
  const dryEmployees = seedEmployees.map((employee, index) => ({
    id: `dry-${index + 1}`,
    fullName: employee.fullName,
    region: employee.region,
    team: employee.team,
    active: employee.active,
  }));
  const dryMentions = summary.flatMap((location) =>
    location.reviews.map((review) => ({
      googleReviewId: review.googleReviewId,
      mentions: detectMentionedEmployees(review.text, dryEmployees).employees.map(
        (employee) => employee.fullName
      ),
      ambiguous: detectMentionedEmployees(review.text, dryEmployees).type === "ambiguous",
    }))
  );

  console.log(
    JSON.stringify(
      {
        dryRun: true,
        cleanupPlan: {
          duplicateGooglePlaceId: "mock_place_id_calgary",
          deleteLinkedReviewsFirst: true,
        },
        locationsPlanned: seedData.length,
        reviewsPlanned: seedData.reduce((sum, location) => sum + location.reviews.length, 0),
        reviewVersionsPlanned: 2,
        employeesPlanned: seedEmployees.length,
        mentionDetectionPreview: dryMentions,
        plan: summary,
      },
      null,
      2
    )
  );
}

async function cleanupDuplicateCalgaryLocation() {
  const duplicate = await prisma.location.findUnique({
    where: { googlePlaceId: "mock_place_id_calgary" },
    select: { id: true },
  });

  if (!duplicate) {
    return { removedLocation: false, removedReviews: 0 };
  }

  const deletedReviews = await prisma.review.deleteMany({
    where: { locationId: duplicate.id },
  });

  await prisma.location.delete({
    where: { id: duplicate.id },
  });

  return { removedLocation: true, removedReviews: deletedReviews.count };
}

async function ensureLocation(location: SeedLocation) {
  return prisma.location.upsert({
    where: { googlePlaceId: location.googlePlaceId },
    update: { name: location.name },
    create: {
      name: location.name,
      googlePlaceId: location.googlePlaceId,
    },
  });
}

async function ensureReview(locationId: string, review: SeedLocation["reviews"][number]) {
  return prisma.review.upsert({
    where: { googleReviewId: review.googleReviewId },
    update: {
      locationId,
      reviewerName: review.reviewerName,
      rating: review.rating,
      text: review.text,
      reviewTime: review.reviewTime,
    },
    create: {
      locationId,
      googleReviewId: review.googleReviewId,
      reviewerName: review.reviewerName,
      rating: review.rating,
      text: review.text,
      reviewTime: review.reviewTime,
    },
  });
}

async function seedReviewVersions() {
  const targetReviewByGoogleId = await prisma.review.findUnique({
    where: { googleReviewId: "seed_review_calgary_002" },
    select: { id: true, googleReviewId: true, reviewerName: true },
  });
  const fallbackReview = await prisma.review.findFirst({
    select: { id: true, googleReviewId: true, reviewerName: true },
    orderBy: { reviewTime: "desc" },
  });
  const targetReview = targetReviewByGoogleId ?? fallbackReview;
  const targetReviewId = targetReview?.id;

  if (!targetReviewId) return { reviewVersionsInserted: 0 };
  console.log("ReviewVersions target:", {
    id: targetReview.id,
    googleReviewId: targetReview.googleReviewId ?? null,
    reviewer: targetReview.reviewerName ?? null,
  });

  const snapshots = [
    {
      rating: 4,
      text: "Initial experience was decent.",
      capturedAt: "2026-02-10T12:00:00.000Z",
    },
    {
      rating: 2,
      text: "Scheduling delays made the process frustrating.",
      capturedAt: "2026-02-12T12:00:00.000Z",
    },
  ];

  let inserted = 0;
  for (const snapshot of snapshots) {
    const capturedAtDate = new Date(snapshot.capturedAt);
    const existingByCapturedAt = await prisma.alertLog.findFirst({
      where: {
        reviewId: targetReviewId,
        type: "review_version",
        createdAt: capturedAtDate,
      },
      select: { id: true },
    });
    if (existingByCapturedAt) {
      console.log(`ReviewVersion exists for capturedAt ${snapshot.capturedAt}`);
      continue;
    }

    await prisma.alertLog.create({
      data: {
        reviewId: targetReviewId,
        type: "review_version",
        message: JSON.stringify({
          kind: "review_version",
          rating: snapshot.rating,
          text: snapshot.text,
          capturedAt: snapshot.capturedAt,
        }),
        createdAt: capturedAtDate,
      },
    });
    inserted += 1;
  }

  return { reviewVersionsInserted: inserted };
}

async function ensureEmployees() {
  let createdOrUpdated = 0;

  for (const seedEmployee of seedEmployees) {
    const existing = await prisma.employee.findFirst({
      where: { fullName: seedEmployee.fullName },
      select: { id: true },
    });

    if (existing) {
      await prisma.employee.update({
        where: { id: existing.id },
        data: { isActive: seedEmployee.active },
      });
      createdOrUpdated += 1;
      continue;
    }

    await prisma.employee.create({
      data: {
        fullName: seedEmployee.fullName,
        isActive: seedEmployee.active,
      },
    });
    createdOrUpdated += 1;
  }

  return createdOrUpdated;
}

async function deduplicateEmployeesByFullName() {
  const employees = await prisma.employee.findMany({
    orderBy: [{ fullName: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      fullName: true,
      createdAt: true,
    },
  });

  const byFullName = new Map<string, Array<{ id: string; fullName: string; createdAt: Date }>>();
  for (const employee of employees) {
    const group = byFullName.get(employee.fullName) ?? [];
    group.push(employee);
    byFullName.set(employee.fullName, group);
  }

  let duplicateEmployeesFound = 0;
  let duplicateEmployeesRemoved = 0;
  let mentionRowsRepointed = 0;
  const dedupeSkipFullNames = new Set(["Alex Johnson", "Alex Smith"]);

  for (const group of byFullName.values()) {
    if (group.length <= 1) continue;
    if (dedupeSkipFullNames.has(group[0].fullName)) continue;
    duplicateEmployeesFound += group.length - 1;

    const [kept, ...duplicates] = group;
    for (const duplicate of duplicates) {
      const duplicateMentions = await prisma.employeeMention.findMany({
        where: { employeeId: duplicate.id },
        select: { id: true, reviewId: true },
      });

      for (const mention of duplicateMentions) {
        const existingForKept = await prisma.employeeMention.findFirst({
          where: {
            reviewId: mention.reviewId,
            employeeId: kept.id,
          },
          select: { id: true },
        });

        if (existingForKept) {
          await prisma.employeeMention.delete({
            where: { id: mention.id },
          });
          continue;
        }

        await prisma.employeeMention.update({
          where: { id: mention.id },
          data: { employeeId: kept.id },
        });
        mentionRowsRepointed += 1;
      }

      await prisma.employee.delete({
        where: { id: duplicate.id },
      });
      duplicateEmployeesRemoved += 1;
    }
  }

  return { duplicateEmployeesFound, duplicateEmployeesRemoved, mentionRowsRepointed };
}

async function runAutoMentionDetectionForSeededReviews() {
  const seededReviewIds = seedData.flatMap((location) =>
    location.reviews.map((review) => review.googleReviewId)
  );

  const [reviews, employees] = await Promise.all([
    prisma.review.findMany({
      where: { googleReviewId: { in: seededReviewIds } },
      select: {
        id: true,
        text: true,
      },
    }),
    prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
      },
    }),
  ]);

  await prisma.employeeMention.deleteMany({
    where: {
      reviewId: { in: reviews.map((review) => review.id) },
    },
  });

  let mentionRows = 0;
  const employeeMentionModel = (Prisma as any).dmmf.datamodel.models.find(
    (model: any) => model.name === "EmployeeMention"
  );
  const employeeMentionFields = new Map<string, any>(
    (employeeMentionModel?.fields ?? []).map((field: any) => [field.name, field])
  );
  const hasField = (field: string) => employeeMentionFields.has(field);
  const hasDetectionMethod = hasField("detectionMethod");
  const hasAmbiguityFlag = hasField("ambiguityFlag");
  const hasConfidenceScore = hasField("confidenceScore");
  const hasConfidence = hasField("confidence");
  const employeeIdField = employeeMentionFields.get("employeeId");
  const employeeIdNullable = Boolean(employeeIdField && employeeIdField.isRequired === false);

  function buildMentionData(input: {
    reviewId: string;
    employeeId?: string | null;
    detectionMethod?: string;
    ambiguityFlag?: boolean;
    confidenceScore?: number | null;
  }) {
    const data: Record<string, unknown> = {
      reviewId: input.reviewId,
    };

    if (input.employeeId !== undefined && (input.employeeId !== null || employeeIdNullable)) {
      data.employeeId = input.employeeId;
    }

    if (hasDetectionMethod && input.detectionMethod !== undefined) {
      data.detectionMethod = input.detectionMethod;
    }

    if (hasAmbiguityFlag && input.ambiguityFlag !== undefined) {
      data.ambiguityFlag = input.ambiguityFlag;
    }

    if (hasConfidenceScore && input.confidenceScore !== undefined) {
      data.confidenceScore = input.confidenceScore;
    } else if (hasConfidence && input.confidenceScore !== undefined && input.confidenceScore !== null) {
      data.confidence = input.confidenceScore;
    } else if (hasConfidence && input.employeeId) {
      data.confidence = 1.0;
    }

    return data;
  }

  for (const review of reviews) {
    const detection = detectMentionedEmployees(review.text ?? "", employees);

    if (detection.type === "ambiguous") {
      const ambiguousWhere: Record<string, unknown> = { reviewId: review.id };
      if (employeeIdNullable) {
        ambiguousWhere.employeeId = null;
      }
      if (hasAmbiguityFlag) {
        ambiguousWhere.ambiguityFlag = true;
      }

      const existingAmbiguous = await prisma.employeeMention.findFirst({
        where: ambiguousWhere as any,
      });

      if (!existingAmbiguous) {
        const ambiguousData = buildMentionData({
          reviewId: review.id,
          employeeId: employeeIdNullable ? null : undefined,
          detectionMethod: "auto",
          ambiguityFlag: true,
          confidenceScore: null,
        });

        if (!employeeIdNullable && !hasAmbiguityFlag) {
          continue;
        }

        await prisma.employeeMention.create({
          data: ambiguousData as any,
        });
        mentionRows += 1;
      }

      continue;
    }

    if (detection.type !== "resolved") {
      continue;
    }

    for (const employee of detection.employees) {
      const existingMention = await prisma.employeeMention.findFirst({
        where: {
          reviewId: review.id,
          employeeId: employee.id,
        },
      });

      if (existingMention) {
        continue;
      }

      await prisma.employeeMention.create({
        data: buildMentionData({
          reviewId: review.id,
          employeeId: employee.id,
          detectionMethod: "auto",
          ambiguityFlag: false,
          confidenceScore: 1.0,
        }) as any,
      });

      mentionRows += 1;
    }
  }

  return mentionRows;
}

async function main() {
  const dbInfoRows = await prisma.$queryRaw<Array<{ db: string; addr: string | null; port: number | null }>>`
    SELECT current_database()::text as db, inet_server_addr()::text as addr, inet_server_port()::int as port
  `;
  const dbInfo = dbInfoRows[0] ?? { db: "", addr: null, port: null };
  console.log("[seed dbInfo]", { db: dbInfo.db, addr: dbInfo.addr, port: dbInfo.port });

  if (isDryRun) {
    printDryRunPlan();
    return;
  }

  const cleanup = await cleanupDuplicateCalgaryLocation();
  let locationCount = 0;
  let reviewCount = 0;

  for (const location of seedData) {
    const savedLocation = await ensureLocation(location);
    locationCount += 1;

    for (const review of location.reviews) {
      await ensureReview(savedLocation.id, review);
      reviewCount += 1;
    }
  }
  const employeeCount = await ensureEmployees();
  const dedupeSummary = await deduplicateEmployeesByFullName();
  const mentionCount = await runAutoMentionDetectionForSeededReviews();
  const reviewVersionSummary = await seedReviewVersions();

  console.log(
    JSON.stringify(
      {
        dryRun: false,
        cleanup,
        locationsUpserted: locationCount,
        reviewsUpserted: reviewCount,
        employeesUpserted: employeeCount,
        mentionRowsUpserted: mentionCount,
        duplicateEmployeesFound: dedupeSummary.duplicateEmployeesFound,
        duplicateEmployeesRemoved: dedupeSummary.duplicateEmployeesRemoved,
        mentionRowsRepointed: dedupeSummary.mentionRowsRepointed,
        reviewVersionsInserted: reviewVersionSummary.reviewVersionsInserted,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
