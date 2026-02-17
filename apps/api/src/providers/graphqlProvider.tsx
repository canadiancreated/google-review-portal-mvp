import { PropsWithChildren } from "react";
import { Client, Provider, cacheExchange, fetchExchange } from "urql";

const client = new Client({
  url: "http://localhost:4000/graphql",
  exchanges: [cacheExchange, fetchExchange],
});

export function GraphQLProvider({ children }: PropsWithChildren) {
  return <Provider value={client}>{children}</Provider>;
}
