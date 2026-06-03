// ??$$$ group 3 - Components BOM & Wiring (Phase 2)
// ??$$$ newer code
import Part from "../models/part.model";

export interface ISearchLibraryOptions {
  query: string;
  limit?: number;
  strategy?: "auto" | "local_only" | "remote_only";
}

export interface IFormattedPart {
  id: string;
  name: string;
  mpn: string;
  manufacturer: string;
  description: string;
  imageUrl?: string;
  datasheetUrl?: string;
  specs?: any;
  available?: number;
  price?: number;
  wokwiPartType?: string;
  isCurated?: boolean;
}

/**
 * octopartSearch - Queries the Nexar (Octopart v4) GraphQL API
 */
export async function octopartSearch(query: string, limit: number): Promise<IFormattedPart[]> {
  const token = process.env.access_token;
  if (!token) {
    console.warn("[Octopart] No Nexar access_token found in environment variables. Skipping live search.");
    return [];
  }

  try {
    const graphqlQuery = {
      query: `
        query Search($q: String!, $limit: Int!) {
          supSearchMpn(q: $q, limit: $limit) {
            results {
              part {
                mpn
                name
                shortDescription
                manufacturer { name }
                images { url }
                documentCollections {
                  name
                  documents {
                    url
                  }
                }
                specs { attribute { name } displayValue }
                totalAvail
                sellers {
                  offers {
                    prices { price currency }
                  }
                }
              }
            }
          }
        }
      `,
      variables: { q: query, limit }
    };

    console.log(`[Octopart] Fetching from Nexar GraphQL API for query: "${query}"...`);
    const res = await fetch("https://api.nexar.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(graphqlQuery)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Octopart] API response error (${res.status}): ${errText}`);
      return [];
    }

    const json = await res.json();
    const results = json?.data?.supSearchMpn?.results || [];

    return results.map((r: any) => {
      if (!r?.part) return null;
      const p = r.part;

      // Extract image
      const imageUrl = p.images?.[0]?.url || "";

      // Extract datasheet from document collections
      let datasheetUrl = "";
      const docColls = p.documentCollections || [];
      for (const coll of docColls) {
        const docs = coll.documents || [];
        if (docs.length > 0 && docs[0]?.url) {
          datasheetUrl = docs[0].url;
          break;
        }
      }

      // Map specifications to key-value pairs
      const specs: Record<string, string> = {};
      if (Array.isArray(p.specs)) {
        p.specs.forEach((s: any) => {
          if (s?.attribute?.name) {
            specs[s.attribute.name] = s.displayValue || "";
          }
        });
      }

      // Extract first available price
      let price = 0;
      const sellers = p.sellers || [];
      for (const seller of sellers) {
        const offers = seller.offers || [];
        for (const offer of offers) {
          const prices = offer.prices || [];
          if (prices.length > 0 && typeof prices[0].price === "number") {
            price = prices[0].price;
            break;
          }
        }
        if (price > 0) break;
      }

      return {
        id: p.mpn,
        name: p.name || p.mpn,
        mpn: p.mpn,
        manufacturer: p.manufacturer?.name || "Unknown",
        description: p.shortDescription || "",
        imageUrl,
        datasheetUrl,
        specs,
        available: p.totalAvail || 0,
        price,
        isCurated: false
      };
    }).filter(Boolean) as IFormattedPart[];

  } catch (err: any) {
    console.error("[Octopart] Nexar search failed:", err.message || err);
    return [];
  }
}

/**
 * searchLibrary - Hybrid search that queries MongoDB first, then falls back to Octopart if needed.
 */
export async function searchLibrary(options: ISearchLibraryOptions): Promise<IFormattedPart[]> {
  const { query, limit = 5, strategy = "auto" } = options;

  if (!query || !query.trim()) return [];

  let localResults: IFormattedPart[] = [];
  let remoteResults: IFormattedPart[] = [];

  // 1. Check local curated parts (MongoDB)
  if (strategy === "auto" || strategy === "local_only") {
    try {
      console.log(`[LibraryService] Querying MongoDB local text search for: "${query}"`);
      const mongoParts = await Part.find(
        { $text: { $search: query } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(limit * 2) // Fetch a bit more to allow deduplication / selection
        .lean();

      localResults = mongoParts.map((p: any) => ({
        id: p.mpn,
        name: p.name,
        mpn: p.mpn,
        manufacturer: p.manufacturer,
        description: p.description,
        imageUrl: p.imageUrl,
        datasheetUrl: p.datasheetUrl,
        specs: p.specs,
        available: p.available,
        price: p.price,
        wokwiPartType: p.wokwiPartType,
        isCurated: true
      }));

      console.log(`[LibraryService] Local search returned ${localResults.length} matches.`);
    } catch (err: any) {
      console.error("[LibraryService] Local MongoDB search failed:", err.message || err);
    }
  }

  // 2. Query Octopart if needed
  if (strategy === "remote_only" || (strategy === "auto" && localResults.length < limit)) {
    const remainingLimit = limit - localResults.length;
    const fetchLimit = strategy === "remote_only" ? limit : Math.max(remainingLimit, limit);
    remoteResults = await octopartSearch(query, fetchLimit);
    console.log(`[LibraryService] Octopart search returned ${remoteResults.length} matches.`);
  }

  // 3. Merge, Deduplicate by MPN, and slice to limit
  const merged = [...localResults, ...remoteResults];
  const seenMpn = new Set<string>();
  const deduplicated: IFormattedPart[] = [];

  for (const part of merged) {
    const normalizedMpn = part.mpn.toUpperCase().trim();
    if (!seenMpn.has(normalizedMpn)) {
      seenMpn.add(normalizedMpn);
      deduplicated.push(part);
    }
  }

  return deduplicated.slice(0, limit);
}
