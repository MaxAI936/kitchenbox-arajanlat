import { createFileRoute } from "@tanstack/react-router";
const handle = async ({ request }: { request: Request }) =>
  (await import("../server/api")).handle(request);
export const Route = createFileRoute("/api/$")({
  server: {
    handlers: { GET: handle, HEAD: handle, POST: handle, PUT: handle },
  },
});
