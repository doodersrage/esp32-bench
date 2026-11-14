// Amazon links for shoppers outside the US. Amazon Associates tags belong to
// one store each, so a link is moved to the visitor's own Amazon store only
// when PUBLIC_AMAZON_TAGS names a tag for that store; everyone else keeps the
// amazon.com link. Product links become a search on the local store, since
// the same product can have a different listing (ASIN) there.
import { amazonStoreFor, localAmazonHref } from "../lib/shop";

const tags = JSON.parse(document.documentElement.dataset.amazonTags || "{}") as Record<string, string>;

function country(): string {
  for (const l of navigator.languages ?? [navigator.language]) {
    const region = /^[a-z]{2,3}[-_]([A-Z]{2})\b/i.exec(l)?.[1];
    if (region) return region.toUpperCase();
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  return { "Europe/London": "GB", "Europe/Berlin": "DE", "Europe/Paris": "FR", "Europe/Madrid": "ES", "Europe/Rome": "IT", "Europe/Amsterdam": "NL", "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Asia/Kolkata": "IN", "Asia/Tokyo": "JP", "America/Toronto": "CA", "America/Vancouver": "CA" }[tz] ?? "";
}

const store = amazonStoreFor(country());
const tag = store ? tags[store] : undefined;

/** Point every Amazon link under `root` at the local store. Safe to call again on new links. */
export function localiseAmazon(root: ParentNode = document) {
  if (!store || !tag) return;
  for (const a of root.querySelectorAll<HTMLAnchorElement>("a[data-amazon-q]")) {
    const href = localAmazonHref(a.dataset.amazonQ ?? "", store, tag);
    if (a.href !== href) a.href = href;
  }
}

localiseAmazon();
