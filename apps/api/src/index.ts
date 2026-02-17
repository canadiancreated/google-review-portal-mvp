import { createServer } from "http";
import { createSchema, createYoga } from "graphql-yoga";
import { resolvers, typeDefs } from "./graphql/schema";

const yoga = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),
});

const server = createServer(yoga);

server.listen(4000, () => {
  console.log("GraphQL API running at http://localhost:4000/graphql");
});
