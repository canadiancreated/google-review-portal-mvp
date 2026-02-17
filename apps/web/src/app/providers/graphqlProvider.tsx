import { PropsWithChildren } from "react";
import { Client, Provider, cacheExchange, fetchExchange } from "urql";

const graphqlUrl = import.meta.env.VITE_GRAPHQL_URL as string;

const client = new Client({
  url: graphqlUrl,
  exchanges: [cacheExchange, fetchExchange],
});

export function GraphQLProvider({ children }: PropsWithChildren) {
  return <Provider value={client}>{children}</Provider>;
}
