export function GET() {
  return Response.json({
    name: "Nat's Inbox",
    short_name: "Inbox",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#faf8f5",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  });
}
