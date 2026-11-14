interface ImportMetaEnv {
  /** Optional Amazon Associates tag appended to Amazon buy links. */
  readonly PUBLIC_AMAZON_ASSOCIATE_TAG?: string;
  /** Optional Associates tags for other Amazon stores, as JSON: {"co.uk":"name-21","de":"name-21"}. */
  readonly PUBLIC_AMAZON_TAGS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
