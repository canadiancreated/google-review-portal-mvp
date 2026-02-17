import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { GraphQLProvider } from "./app/providers/graphqlProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GraphQLProvider>
      <App />
    </GraphQLProvider>
  </StrictMode>
);
