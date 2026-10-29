import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import PreviewApp from "./PreviewApp.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {window.location.pathname.replace(/\/$/, "") === "/editor" ? <App /> : <PreviewApp />}
  </React.StrictMode>,
);
