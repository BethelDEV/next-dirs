/** In-memory external services. These doubles never open a network connection. */
export class FakePublisher<T extends { version: number }> {
  documents = new Map<string, T>();
  failure: "before" | "after" | undefined;

  async write(id: string, value: T) {
    if (this.failure === "before") throw new Error("publisher unavailable");
    const previous = this.documents.get(id);
    if (!previous || previous.version < value.version) {
      this.documents.set(id, structuredClone(value));
    }
    if (this.failure === "after") throw new Error("response lost");
  }
}

export class FakeNotifications {
  deliveries = new Map<string, { to: string; subject: string }>();
  fail = false;

  async send(key: string, message: { to: string; subject: string }) {
    if (this.fail) throw new Error("mail unavailable");
    this.deliveries.set(key, structuredClone(message));
  }
}

export const synthetic = {
  owner: { id: "user-owner", email: "owner@example.invalid", role: "USER" },
  stranger: {
    id: "user-stranger",
    email: "stranger@example.invalid",
    role: "USER",
  },
  editor: {
    id: "user-editor",
    email: "editor@example.invalid",
    role: "EDITOR",
  },
  admin: { id: "user-admin", email: "admin@example.invalid", role: "ADMIN" },
  listing: {
    name: "Local directory example",
    link: "https://example.invalid",
    description: "Synthetic content for local checks",
    introduction: "## Features\n\nA local fixture.",
    categories: ["category-tools"],
    tags: ["tag-local"],
    imageId: "image-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-800x600-png",
  },
  payment: { id: "evt_local_paid", amount: 9900, currency: "usd" },
  ai: {
    name: "Local example",
    description: "Generated fixture without AI calls",
  },
} as const;
