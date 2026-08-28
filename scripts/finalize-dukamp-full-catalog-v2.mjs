import { readFile, writeFile } from "node:fs/promises";

const path = "src/lib/site/site-lookup.server.ts";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Trecho não encontrado: ${label}`);
  source = source.slice(0, index) + after + source.slice(index + before.length);
}

replaceOnce(
  `      const words = \`${"${name} ${code} ${slug} ${brand} ${description}"}\`.split(/\\s+/).filter(Boolean);\n      const hits = tokens.filter((token) => fuzzyTokenHit(token, words)).length;`,
  `      const coreWords = \`${"${name} ${code} ${slug} ${brand}"}\`.split(/\\s+/).filter(Boolean);\n      const descriptionWords = new Set(description.split(/\\s+/).filter(Boolean));\n      const allowDescriptionOnly = tokens.length > 1 || PURPOSE_RE.test(query);\n      const strongCoreHit = (token: string) =>\n        coreWords.some((word) => {\n          if (!word) return false;\n          if (word === token) return true;\n          if (word.length < 3 || token.length < 3) return false;\n          if (word.length >= 4 && token.length >= 4 && (word.includes(token) || token.includes(word)))\n            return true;\n          return (\n            token.length >= 4 &&\n            word.length >= 4 &&\n            Math.abs(word.length - token.length) <= 2 &&\n            editDistance(token, word) <= 2\n          );\n        });\n      const hits = tokens.filter(\n        (token) =>\n          strongCoreHit(token) ||\n          (allowDescriptionOnly &&\n            (descriptionWords.has(token) || (token.length >= 5 && description.includes(token)))),\n      ).length;`,
  "snapshot scoring sem falso positivo na descrição",
);

replaceOnce(
  `    if (response.error) {\n      const snapshot = searchSnapshotProducts(query, limit, listAll);\n      if (snapshot.length) return finishSnapshot(operation, started, snapshot);\n      return finish(operation, started, [], response.error);\n    }`,
  `    if (response.error) {\n      const snapshot = searchSnapshotProducts(query, limit, listAll);\n      return finish(operation, started, snapshot, response.error);\n    }`,
  "preservar erro da busca direta",
);

replaceOnce(
  `  } catch (error) {\n    const snapshot = searchSnapshotProducts(query, limit);\n    return snapshot.length ? finishSnapshot(operation, started, snapshot) : finish(operation, started, [], error);\n  }\n}\n\nexport async function queryRecommendedSiteProducts(`,
  `  } catch (error) {\n    const snapshot = searchSnapshotProducts(query, limit);\n    return finish(operation, started, snapshot, error);\n  }\n}\n\nexport async function queryRecommendedSiteProducts(`,
  "preservar exceção da busca direta",
);

replaceOnce(
  `    if (response.error) {\n      const snapshot = rankDuKampProductsForNeed(\n        snapshotProducts.map(snapshotToSiteProduct),\n        query,\n        limit,\n      );\n      if (snapshot.length) return finishSnapshot(operation, started, snapshot);\n      return finish(operation, started, [], response.error);\n    }`,
  `    if (response.error) {\n      const snapshot = rankDuKampProductsForNeed(\n        snapshotProducts.map(snapshotToSiteProduct),\n        query,\n        limit,\n      );\n      return finish(operation, started, snapshot, response.error);\n    }`,
  "preservar erro da recomendação",
);

replaceOnce(
  `  } catch (error) {\n    const snapshot = rankDuKampProductsForNeed(\n      snapshotProducts.map(snapshotToSiteProduct),\n      query,\n      limit,\n    );\n    return snapshot.length ? finishSnapshot(operation, started, snapshot) : finish(operation, started, [], error);\n  }\n}\n\nexport async function querySiteSellers(`,
  `  } catch (error) {\n    const snapshot = rankDuKampProductsForNeed(\n      snapshotProducts.map(snapshotToSiteProduct),\n      query,\n      limit,\n    );\n    return finish(operation, started, snapshot, error);\n  }\n}\n\nexport async function querySiteSellers(`,
  "preservar exceção da recomendação",
);

replaceOnce(
  `      if (match.sellers.length) {\n        const result: SiteQueryResult<SiteSeller[]> = {\n          status: "snapshot",\n          data: match.sellers as SiteSeller[],\n          errorCode: "live_catalog_fallback",\n          durationMs: Date.now() - started,\n          count: match.sellers.length,\n        };\n        logQuery(operation, result);\n        return result;\n      }\n      return finish(operation, started, [], response.error);`,
  `      return finish(operation, started, match.sellers as SiteSeller[], response.error);`,
  "preservar erro dos vendedores",
);

replaceOnce(
  `    if (match.sellers.length) {\n      const result: SiteQueryResult<SiteSeller[]> = { status: "snapshot", data: match.sellers as SiteSeller[], errorCode: "live_catalog_fallback", durationMs: Date.now() - started, count: match.sellers.length };\n      logQuery(operation, result);\n      return result;\n    }\n    return finish(operation, started, [], error);`,
  `    return finish(operation, started, match.sellers as SiteSeller[], error);`,
  "preservar exceção dos vendedores",
);

await writeFile(path, source, "utf8");
console.log("Fallback do snapshot preservando status vivo aplicado.");
