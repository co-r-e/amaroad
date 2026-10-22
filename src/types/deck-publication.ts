/** Whether a deck is included in ordinary Git commits and pushes. */
export type DeckPublicationStatus = "public" | "excluded" | "unknown";

export type DeckPublicationStatuses = Record<string, DeckPublicationStatus>;
