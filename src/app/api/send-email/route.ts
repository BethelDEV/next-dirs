// Approval notifications are created by authenticated workflow transitions.
export async function POST() {
  return Response.json(
    { message: "Use the application review workflow" },
    { status: 410 },
  );
}
