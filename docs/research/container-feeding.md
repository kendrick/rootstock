# Container Feeding for Esperanza and Hardy Hibiscus

Researched 2026-09-29 against `esperanza-feeding` in `src/seed/rules.json`, the seed's one container-feeding Rule. It targets `esperanza-1` by plant id, carries `kind: "cadence"` at every 28 to 42 days (roughly 4 to 6 weeks), runs 03-15 through 10-07, is tagged `container` and `fertilizer`, and cites `kind: "owner"` with no URL. The question this file answers: does the owner's 4-to-6-week cadence hold for both container-grown Esperanza (Tecoma stans) and container-grown hardy hibiscus (Hibiscus moscheutos hybrids: 'Watermelon Ruffles', 'Starry Night', 'Luna White'), so one Rule could honestly target every fed container by tag, or do the two species pull apart.

## Answer

They pull apart. The sharpest split is inside Esperanza's own guidance, which gives containers and in-ground plantings different cadences. The one Texas A&M AgriLife source that gives Esperanza an actual feeding interval, Bexar County's 'Gold Star' Esperanza article, sets two different cadences in the same paragraph: containers every two weeks, landscape plantings every four to six weeks. The owner's Rule states the landscape number, 4 to 6 weeks, but tags the Rule `container`. On this source, a container Esperanza fed on a 4-to-6-week cadence is fed a half to a third as often as the source recommends.

Hardy hibiscus has no primary source that gives it a repeating cadence at all. Clemson HGIC's Hibiscus moscheutos page, the only source I found that names the species and also gives fertilizing advice, describes one application: "If needed, fertilize with an all-purpose, slow-release fertilizer in late spring." That is a single annual event, not an interval, and the page does not separate container culture from in-ground culture even though it recommends containers for compact cultivars. Texas A&M's own hardy-hibiscus article (Welsh, 2004) covers the giant rose mallow—the common name for Hibiscus moscheutos hybrids such as 'Southern Belle'—and gives it no fertilizing guidance at all; the only fertilizing sentence in that article belongs to a different plant, Hibiscus coccineus (Texas Star Hibiscus), and reads "an annual application of fertilizer in spring or early summer." Applying that sentence to H. moscheutos would be borrowing it across a species line the article itself draws.

So the two plants don't share evidence for a single cadence, and Esperanza doesn't even share one cadence with itself across container and ground. A shared `container` + `fertilizer` tag cadence of 4 to 6 weeks has a primary source for Esperanza only if the plant is in the ground; it has no primary source at all, for either the interval or the season, if the plant named in the tag is a hardy hibiscus.

## Esperanza (Tecoma stans)

| Question              | Container guidance                                             | In-ground / landscape guidance             | Source                       |
| --------------------- | -------------------------------------------------------------- | ------------------------------------------ | ---------------------------- |
| Interval              | Every 2 weeks                                                  | Every 4 to 6 weeks                         | Bexar County AgriLife, below |
| Fertilizer type       | Diluted water-soluble 20-20-20, or controlled-release granules | "Light applications," analysis unspecified | Same                         |
| Season / months       | Not dated; tied to "daily watering and high temperatures"      | Not dated                                  | Same                         |
| Initial planting dose | 19-5-9 slow-release, 2 lb per 100 sq ft, worked into the soil  | Same                                       | Same                         |

The source: David Rodriguez, County Extension Agent–Horticulture for Bexar County (a Texas A&M AgriLife Extension county office), "'Gold Star' Esperanza," dated 2006-09-03. https://bexar-tx.tamu.edu/homehort/archives-of-weekly-articles-davids-plant-of-the-week/gold-star-esperanza/—fetched successfully. Its fertilizing paragraph in full:

> "Feed container-grown plants with a diluted water-soluble 20-20-20 or Host agro fertilizer every other week, or use controlled-release granules according to the formula recommendation. Keep in mind that daily watering and high temperatures usually mean fertilizing more often. Feed those plants in the landscape every four to six weeks with light applications of fertilizer."

"Host agro" is exactly what the fetch returned; I could not confirm it's a real product name (it may be a garbled rendering of a Texas-market brand such as HastaGro) and I'm not correcting it. Earlier in the same article: "While preparing the soil, incorporate 2 pounds of a slow-release, 19-5-9 fertilizer per 100 square feet of planting area." And on containers generally: "Grow them in large containers around the porch, patio or deck, or plant in fertile, well-drained soil in the tropical-style garden. It is generally sold in one gallon or three gallon containers." The article gives no calendar months for either cadence—"every other week" and "every four to six weeks" are stated with no start or stop date, only the implicit growing season ("blooms... from spring through frost").

Three other primary sources on Esperanza carry no fertilizing guidance at all:

- Douglas Welsh, "Esperanza (Tecoma stans)," Texas AgriLife Extension Service HortUpdate, June 2009. Live URL redirect-loops between aggie-hort.tamu.edu and aggie-horticulture.tamu.edu, so I read the Wayback capture. https://web.archive.org/web/20201206125833/https://aggie-horticulture.tamu.edu/newsletters/hortupdate/2009/jun09/Esperanza.html—fetched successfully (via direct retrieval, not WebFetch, which cannot reach web.archive.org). The full article covers Esperanza's history, cultivars, and cold hardiness. It contains no sentence about fertilizer, feeding, or nutrients.
- Aggie Horticulture's Texas Native Plants Database entry for Tecoma stans. Same redirect problem; read via Wayback. https://web.archive.org/web/20210410221049/https://aggie-horticulture.tamu.edu/ornamentals/nativeshrubs/tecomastans.htm—fetched successfully. It gives bloom period, height, water and soil requirements, and this on container use north of San Antonio: "North of there it should be used as an annual or as a fast growing, large container plant which may be moved into warmer winter quarters." No fertilizing content.
- NC State Extension Gardener Plant Toolbox, Tecoma stans. https://plants.ces.ncsu.edu/plants/tecoma-stans/—fetched successfully. Covers light, soil, watering, deadheading, pruning, propagation, and winter hardiness; confirms container use ("It is also used in the landscape mixed in with other border shrubs, patios or containers") but does not mention fertilizer anywhere.

One URL a search implied would help did not: texassuperstar.com's official page for 'Gold Star' Esperanza. https://texassuperstar.com/gold-star-esperanza/—fetched successfully, but it contains no sentence about fertilizing, feeding, or nutrients, contrary to what the search-engine summary claimed before I opened the page.

## Hardy Hibiscus (Hibiscus moscheutos hybrids)

| Question        | Container guidance                     | In-ground guidance                         | Source              |
| --------------- | -------------------------------------- | ------------------------------------------ | ------------------- |
| Interval        | Not distinguished from in-ground       | One annual event, not a repeating interval | Clemson HGIC, below |
| Fertilizer type | "All-purpose, slow-release fertilizer" | Same                                       | Same                |
| Season / months | "Late spring"                          | Same                                       | Same                |
| Other feeding   | None specified                         | "Apply a 2-inch layer of compost annually" | Same                |

The one source that names Hibiscus moscheutos and also addresses fertilizing: Clemson Cooperative Extension Home & Garden Information Center, "Hardy Hibiscus (Hibiscus moscheutos): How to Grow and Care for Hardy Hibiscus." https://hgic.clemson.edu/hardy-hibiscus-hibiscus-moscheutos-how-to-grow-and-care-for-hardy-hibiscus/—fetched successfully.

> "Apply a 2-inch layer of compost annually."
> "If needed, fertilize with an all-purpose, slow-release fertilizer in late spring."

On containers, the same page says: "Many cultivars can be planted in pots with a quality potting soil," offered as a planting option alongside beds and rain gardens, with no separate feeding instruction attached to it. The page gives no NPK analysis and no month range—"late spring" is a single point, not a season with a start and end.

Texas A&M's own hardy-hibiscus article does not fill that gap. Dr. William C. Welch, "Hardy Hibiscus," Texas Cooperative Extension, HortUpdate, July–August 2004. Same redirect/403 problem as the Esperanza pages; read via Wayback. https://web.archive.org/web/20201031144124/https://aggie-horticulture.tamu.edu/newsletters/hortupdate/hortupdate_archives/2004/jul04/HardyHib.html—fetched successfully. It covers three plants under "hardy hibiscus": the giant rose mallow (Hibiscus moscheutos hybrids, including named cultivars like 'Southern Belle' and 'Frisbee', and Dr. Jerry Parsons' 'Moy Grande'), Hibiscus mutabilis (Confederate rose), and Hibiscus coccineus (Texas Star Hibiscus). The giant-rose-mallow paragraph covers bloom size, soil, propagation from seed or cuttings, and cutting the plant back after frost—no fertilizing sentence anywhere in it. The article's only fertilizing sentence is attached to the third plant, a different species:

> "Culture is very easy, with well-drained soil, an annual application of fertilizer in spring or early summer, and a sunny location being most important."

That sentence is about Hibiscus coccineus, not Hibiscus moscheutos. Using it for the hybrids named in the question ('Watermelon Ruffles', 'Starry Night', 'Luna White') would be citing a Texas A&M source for a claim about a plant the source is not making that claim about.

NC State's Extension Gardener Plant Toolbox entry for Hibiscus moscheutos gives no fertilizing guidance either. https://plants.ces.ncsu.edu/plants/hibiscus-moscheutos/—fetched successfully. It covers sun, soil moisture, pinching, deadheading, and cutting back in fall, and confirms container use ("It can also be grown in large containers") but does not mention fertilizer anywhere.

UF/IFAS has a fertilizing schedule for hibiscus, but for the wrong species. D. L. Ingram and L. Rabinowitz, "Hibiscus in Florida," ENH44, University of Florida IFAS Extension, revised June 2004. https://ufdcimages.uflib.ufl.edu/IR/00/00/61/32/00001/MG02000.pdf—fetched and read as a PDF successfully. Its opening line states the scope: "The Chinese hibiscus, Hibiscus rosa-sinensis L., is probably the most popular and widely planted shrub of the tropics"—the tropical hibiscus, not the hardy Hibiscus moscheutos this question is about. Its Fertilization section:

> "Regular fertilization of hibiscus is essential to maintain healthy and vigorous plants. Hibiscus bloom best when fertilized lightly and often. Three or four applications per year have proven satisfactory: 1) early spring, 2) after first growth flush, 3) midsummer, and 4) early winter. The amount of fertilizer per application depends on frequency of fertilization and size of the plants. The rate may range from one-half ounce of 15-5-10 or 15-5-15 fertilizer for a small plant, up to one-half or one pound (225 to 450 grams) for a mature plant per application. Some hibiscus growers fertilize once a month all year round."

On containers, the same document says only, under Planting and Transplanting: "Container-grown hibiscus can be planted any time during the year, but transplanting in the yard is best done during the cooler months"—a planting-date note, not a fertilizing-frequency distinction between pot and ground. Because this whole publication is about Hibiscus rosa-sinensis, none of its fertilizing numbers can be carried over to Hibiscus moscheutos without a species substitution the source doesn't make.

## General Container-Fertilizing Background, Independent of Species

UMN Extension, "Fertilizing and watering container plants." https://extension.umn.edu/managing-soil-and-nutrients/fertilizing-and-watering-container-plants—fetched successfully (also the source behind the prior heat-limited-products.md research). This is not about either species; it's the general mechanism for why a container might need different feeding than the ground:

> "It's a good idea to start regular fertilizer applications between two to six weeks after planting a container, depending on the type of potting media, watering schedule, and rate of plant growth."

On fertilizer type, the page says soluble fertilizers "are a good choice for container plants, where rooting space is at a premium and nutrients are often lost through frequent watering," and that "slow-release fertilizers can also be used effectively in containers, where watering releases small amounts of nutrients over time." On heat, it says a container "may need to water more than once per day during hot, dry weather," and ties that watering load to nutrient loss, suggesting the reader "consider more frequent fertilizer applications at a lower rate to prevent nutrient loss with water drainage."

This matches the direction of the Bexar County Esperanza source (containers fed more often than ground) but doesn't independently confirm a number for either plant in this question; it's the general horticultural reasoning behind why containers and in-ground plantings would differ at all.

## Where the Two Species Agree and Differ

- Agreement, containers as a method: both plants' primary sources treat containers as a legitimate, even preferred, way to grow them in a hot climate. Bexar County calls Esperanza "a tropical container plant, similar to Hibiscus, Bougainvillea, and Mandevilla," and Clemson recommends pots for compact hardy-hibiscus cultivars.
- Agreement, heat as a driver: both plants' sources tie heat and frequent watering to a container's feeding needs, stated outright for Esperanza and implied only by the general UMN container source for hibiscus, since no hibiscus source discusses containers and fertilizing in the same breath.
- Difference, interval: Esperanza has a stated interval for containers (every 2 weeks) and a different one for the ground (every 4 to 6 weeks). Hardy hibiscus has no stated interval for either; the only species-specific fertilizing advice found is a single "late spring" application, closer to a once-a-year event than a cadence.
- Difference, season: no source for either plant gives calendar start or end months for fertilizing. Esperanza's cadence is anchored to "spring through frost" bloom and to heat and watering, not dates. Hardy hibiscus's single application is anchored to "late spring," a point, not a range. Neither source supports the Rule's 03-15 to 10-07 window, but neither contradicts it either, since no source gives dates precise enough to compare against it.
- Difference, fertilizer type and analysis: Esperanza container guidance names a type, soluble 20-20-20 or CRF granules, and a landscape starting dose, 19-5-9. Hardy hibiscus guidance names only "all-purpose, slow-release," with no analysis and no separate container product.
- Difference, whether container and in-ground even get separate answers: Esperanza's source draws that line explicitly and gives each side its own number. Hardy hibiscus's sources mention containers as a planting method but never reopen the fertilizing question once they get there. Clemson's fertilizing sentence sits in a general section that applies to whichever planting method the reader chose.

## What I Could Not Verify

- Any Texas A&M AgriLife source that fertilizes Hibiscus moscheutos specifically, container or in-ground. The one Texas A&M hardy-hibiscus article covers moscheutos hybrids by common name but gives its only fertilizing sentence to a different species (H. coccineus).
- The exact fertilizer product behind "Host agro" in the Bexar County Esperanza article; I read it as printed and didn't find a matching product name to confirm or correct it.
- Any calendar start/end month for fertilizing either plant, in a container or in the ground. Every interval or single-application date found ("every other week," "every four to six weeks," "late spring") is unanchored to a specific month range.
- Whether 'Watermelon Ruffles', 'Starry Night', or 'Luna White' individually get different fertilizing advice than "Hibiscus moscheutos hybrids" as a group; no source I found addresses these cultivars by name.
- The current, non-archived text of the two aggie-horticulture.tamu.edu Esperanza/hibiscus pages. Both loop through a Cloudflare-fronted redirect or return 403 to a direct fetch; I read Wayback captures instead (dated 2020-12-06, 2021-04-10, and 2020-10-31).
- A UF/IFAS or other land-grant page specifically about the native Hibiscus moscheutos (sometimes called swamp rose mallow or crimsoneyed rosemallow) rather than the garden hybrids; search results pointed at a Santa Rosa County IFAS PDF titled "Swamp Hibiscus," but the PDF's actual content was about a basil hybrid, not hibiscus, so I didn't use it.

## What This Means for the Rule

`esperanza-feeding` states a landscape-Esperanza number (4 to 6 weeks) while tagged and targeted as a container Rule. The primary source found for Esperanza gives containers a different, tighter cadence (every 2 weeks) than the ground (every 4 to 6 weeks), so the Rule's own cadence has a source, just not the one its `container` tag points to.

Hardy hibiscus has no primary source for any repeating cadence, container or ground; the closest thing found is a single "late spring" application with no fertilizer analysis specified. Nothing found here shows hardy hibiscus tolerating, needing, or being harmed by a 4-to-6-week container cadence—it's simply unaddressed in the sources checked.

That leaves the owner two ways to resolve the tag-vs-target question, without this file picking one:

- Keep one shared `container` + `fertilizer` cadence Rule, and keep it sourced as `kind: "owner"` as it is today. No primary source found here supports one shared number across both species and both planting contexts, so `owner` stays the honest label for whatever number is chosen.
- Split into per-species Rules. Esperanza's container Rule could then cite Bexar County AgriLife for a 2-week interval, a change from the current 4-to-6-week number, since that number belongs to the ground planting per the same source. The hardy-hibiscus Rule would have no extension interval to cite and would stay owner-sourced, or fall back to the general UMN container principle: start feeding 2 to 6 weeks after planting, then feed more often than an in-ground planting would.
