import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Layout } from "./layout";
import { HexmapPage } from "./pages/hexmap";
import { DotDensityPage } from "./pages/dotdensity";
import { ServePage } from "./pages/serve";
import { RaysPage } from "./pages/rays";
import { MomentumPage } from "./pages/momentum";
import { OverviewPage } from "./pages/overview";
import "./styles.css";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { element: <OverviewPage />, index: true, path: "/" },
      { element: <HexmapPage />, path: "/hexmap" },
      { element: <DotDensityPage />, path: "/dotdensity" },
      { element: <ServePage />, path: "/serve" },
      { element: <RaysPage />, path: "/rays" },
      { element: <MomentumPage />, path: "/momentum" },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
