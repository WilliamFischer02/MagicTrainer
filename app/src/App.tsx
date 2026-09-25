import { QueryClientProvider } from "@tanstack/react-query";
import "./ui/global.css";
import { AppShell } from "./ui/AppShell";
import { queryClient } from "./ui/queries";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
