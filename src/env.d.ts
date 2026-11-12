interface ImportMetaEnv {
  /** Optional Amazon Associates tag appended to Amazon buy links. */
  readonly PUBLIC_AMAZON_ASSOCIATE_TAG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
