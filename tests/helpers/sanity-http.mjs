/** Local Sanity document/mutation protocol for the production scheduled publisher. */
export async function sanityMutationResponse(request, documents) {
  const url = new URL(request.url);
  if (url.hostname !== "localtest.api.sanity.io") return null;
  if (
    request.method === "POST" &&
    url.pathname.endsWith("/assets/images/local")
  ) {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes[0] !== 137 || bytes[1] !== 80)
      throw new Error("Expected a PNG upload");
    const document = {
      _id: "image-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-1x1-png",
      _type: "sanity.imageAsset",
      url: "https://cdn.sanity.io/images/localtest/local/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-1x1.png",
      metadata: {},
    };
    if (!documents.some((entry) => entry._id === document._id))
      documents.push(document);
    return Response.json({ document });
  }
  const documentPath = "/data/doc/local/";
  if (request.method === "GET" && url.pathname.includes(documentPath)) {
    const id = decodeURIComponent(url.pathname.split(documentPath)[1]);
    const document = documents.find((entry) => entry._id === id);
    return Response.json({
      documents: document ? [document] : [],
      omitted: document ? [] : [{ id, reason: "existence" }],
    });
  }
  if (request.method !== "POST" || !url.pathname.endsWith("/data/mutate/local"))
    return null;
  const { mutations } = await request.json();
  const results = [];
  for (const mutation of mutations) {
    const now = new Date().toISOString();
    if (mutation.createIfNotExists) {
      const value = mutation.createIfNotExists;
      let document = documents.find((entry) => entry._id === value._id);
      if (!document) {
        document = {
          ...value,
          _rev: crypto.randomUUID(),
          _createdAt: now,
          _updatedAt: now,
        };
        documents.push(document);
      }
      results.push({ id: document._id, operation: "create", document });
    } else if (mutation.patch) {
      const patch = mutation.patch;
      const document = documents.find((entry) => entry._id === patch.id);
      if (
        !document ||
        (patch.ifRevisionID && document._rev !== patch.ifRevisionID)
      )
        return Response.json(
          {
            error: { type: "mutationError", description: "Revision conflict" },
          },
          { status: 409 },
        );
      Object.assign(document, patch.set, {
        _rev: crypto.randomUUID(),
        _updatedAt: now,
      });
      for (const key of patch.unset ?? []) delete document[key];
      results.push({ id: document._id, operation: "update", document });
    } else {
      throw new Error("Unsupported synthetic Sanity mutation");
    }
  }
  return Response.json({ transactionId: crypto.randomUUID(), results });
}
