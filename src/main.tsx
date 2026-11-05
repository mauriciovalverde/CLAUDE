import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./styles.css";
import "leaflet/dist/leaflet.css";

// GitHub Pages serve o app em /claude/ — o roteador usa a mesma base do Vite.
const basepath = String(import.meta.env.BASE_URL || "/").replace(/\/$/, "") || "/";
const queryClient = new QueryClient();
const router = createRouter({ routeTree, context: { queryClient }, basepath, scrollRestoration: true, defaultPreloadStaleTime: 0 });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

