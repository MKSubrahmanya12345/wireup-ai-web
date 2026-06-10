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



// ??$$$ newer code
export async function searchLibrary(options: ISearchLibraryOptions): Promise<IFormattedPart[]> {
  const { query, limit = 5, strategy = "auto" } = options;

  if (!query || !query.trim()) return [];

  let localResults: IFormattedPart[] = [];
  let remoteResults: IFormattedPart[] = [];

  // 1. Check local curated parts (MongoDB)
  if (strategy === "auto" || strategy === "local_only") {
    try {
      console.log(`[LibraryService] Smart local search for: "${query}"`);
      const words = query.split(/\s+/).filter(w => w.trim().length > 0);
      const regexConditions = words.map(word => {
        const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        return {
          $or: [
            { name: { $regex: escaped, $options: "i" } },
            { mpn: { $regex: escaped, $options: "i" } },
            { description: { $regex: escaped, $options: "i" } }
          ]
        };
      });

      // Fetch all local parts and rank them in-memory to ensure zero cut-offs
      const mongoParts = await Part.find({}).lean();

      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);

      // Strong keyword constraints to prevent random mismatches (e.g. SD query returning NRF24)
      const strongNouns = [
        { keys: ["sd", "microsd", "card", "storage"], matches: ["sd", "microsd", "card", "storage"] },
        { keys: ["speaker", "audio", "amplifier", "jack", "sound", "dac", "codec", "headphone", "pam8403", "max98357a", "pcm5102a", "dfplayer"], matches: ["speaker", "audio", "amplifier", "jack", "sound", "dac", "codec", "headphone", "buzzer", "music", "volume", "pam8403", "max98357a", "pcm5102a", "dfplayer"] },
        { keys: ["bluetooth", "wifi", "wireless", "nrf24", "hc-05"], matches: ["bluetooth", "wifi", "wireless", "nrf24", "radio", "esp32", "communication", "hc-05"] },
        { keys: ["led", "display", "screen", "oled", "lcd", "ili9341", "ssd1306"], matches: ["led", "display", "screen", "oled", "lcd", "ili9341", "ssd1306", "light"] },
        { keys: ["button", "switch", "tactile"], matches: ["button", "switch", "tactile", "key"] },
        { keys: ["charger", "battery", "lipo", "tp4056"], matches: ["charger", "battery", "lipo", "tp4056", "power", "cell"] }
      ];

      localResults = mongoParts.map((p: any) => {
        const nameLower = (p.name || "").toLowerCase();
        const mpnLower = (p.mpn || "").toLowerCase();
        const descLower = (p.description || "").toLowerCase();

        let score = 0;

        // Exact substring match on name/mpn
        if (nameLower.includes(queryLower) || mpnLower.includes(queryLower)) {
          score += 100;
        }

        // Individual word matches
        for (const word of queryWords) {
          if (nameLower.includes(word)) score += 20;
          if (mpnLower.includes(word)) score += 30;
          if (descLower.includes(word)) score += 5;
        }

        // Apply strict noun filters
        for (const rule of strongNouns) {
          const queryHasKey = rule.keys.some(k => queryWords.includes(k) || queryLower.includes(k));
          if (queryHasKey) {
            const partHasMatch = rule.matches.some(m => nameLower.includes(m) || mpnLower.includes(m) || descLower.includes(m));
            if (!partHasMatch) {
              score -= 150; // Heavily penalize mismatch
            }
          }
        }

        return {
          part: {
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
          },
          score
        };
      })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.part);

      console.log(`[LibraryService] Smart local search matched and ranked ${localResults.length} parts.`);
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
