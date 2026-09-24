import { EmptyState, Page } from "../components";
import { CollectionIcon } from "../icons";

export function CollectionScreen() {
  return (
    <Page title="Collection" subtitle="Cards you own, from a ManaBox, TCGplayer or Moxfield export. ManaBox stays the source of truth (Q-008).">
      <EmptyState
        icon={<CollectionIcon />}
        title="No collection imported"
        body="Collection import arrives with the Deck Builder in Phase 2. Once imported, upgrade suggestions prefer cards you already own before anything you'd buy."
      />
    </Page>
  );
}
