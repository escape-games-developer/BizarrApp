import React from "react";
import { createRoot } from "react-dom/client";
import BizarrApp from "./App";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BizarrApp />
  </React.StrictMode>
);