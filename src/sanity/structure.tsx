import type { StructureResolver } from "sanity/structure";
export const structure = (): StructureResolver => (S) =>
  S.list()
    .title("Content management")
    .items(
      S.documentTypeListItems().filter(
        (item) => !["item"].includes(item.getId()),
      ),
    );
