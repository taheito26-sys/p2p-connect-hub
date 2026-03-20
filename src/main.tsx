import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import "./index.css";

const clerkPublishableKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function MissingClerkKeyScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#f5f7fb",
        color: "#111827",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "560px",
          width: "100%",
          background: "white",
          borderRadius: "16px",
          padding: "28px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ fontSize: "24px", marginBottom: "12px" }}>
          Clerk is not configured
        </h1>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> or{" "}
          <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> to your local env file,
          then restart the Vite dev server.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <App />
      </ClerkProvider>
    ) : (
      <MissingClerkKeyScreen />
    )}
  </StrictMode>
);
