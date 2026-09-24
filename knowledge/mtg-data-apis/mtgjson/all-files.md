# All Files [​](#all-files)

A list of all downloadable files, excluding individual sets and decks, output by the MTGJSON.

You can see a dump of all files, including individual sets and decks by going to the [file server](https://mtgjson.com/api/v5/) directly.

## File Downloads [​](#file-downloads)

> ### AllPrintings [​](#allprintings)
>
> File containing all sets using the [Set](/data-models/set/) Data Model which includes all printings and variations of the [Card (Set)](/data-models/card/card-set/) Data Model, organized by a Set's [code](/data-models/set/#code) property.
>
> Select a file to downloadAllPrintings.jsonAllPrintings.json.bz2AllPrintings.json.gzAllPrintings.json.xzAllPrintings.json.zipAllPrintings.sqlAllPrintings.sql.bz2AllPrintings.sql.gzAllPrintings.sql.xzAllPrintings.sql.zipAllPrintings.sqliteAllPrintings.sqlite.bz2AllPrintings.sqlite.gzAllPrintings.sqlite.xzAllPrintings.sqlite.zipAllPrintings.psqlAllPrintings.psql.bz2AllPrintings.psql.gzAllPrintings.psql.xzAllPrintings.psql.zip

> ### AllPrintingsCSVFiles [​](#allprintingscsvfiles)
>
> File containing a directory of split-out CSV files from the `AllPrintings.json` file, compressed.
>
> Select a file to downloadAllPrintingsCSVFiles.zipAllPrintingsCSVFiles.tar.bz2AllPrintingsCSVFiles.tar.gzAllPrintingsCSVFiles.tar.xzAllPrintingsCSVFiles.tar.zip

> ### AllPrintingsParquetFiles [​](#allprintingsparquetfiles)
>
> File containing a directory of split-out Parquet files from the `AllPrintings.json` file, compressed.
>
> Select a file to downloadAllPrintingsParquetFiles.zipAllPrintingsParquetFiles.tar.bz2AllPrintingsParquetFiles.tar.gzAllPrintingsParquetFiles.tar.xzAllPrintingsParquetFiles.tar.zip

> ### AllDeckFiles [​](#alldeckfiles)
>
> File containing a directory of all individual [Deck](/data-models/deck/) Data Models named by a Deck's [fileName](/data-models/deck/#filename) property, compressed.
>
> Select a file to downloadAllDeckFiles.zipAllDeckFiles.tar.bz2AllDeckFiles.tar.gzAllDeckFiles.tar.xzAllDeckFiles.tar.zip

> ### AllIdentifiers [​](#allidentifiers)
>
> File containing all [Card (Set)](/data-models/card/card-set/) and [Card (Token)](/data-models/card/card-token/) cards organized by the [uuid](/data-models/card/card-set/#uuid) property.
>
> Select a file to downloadAllIdentifiers.jsonAllIdentifiers.json.bz2AllIdentifiers.json.gzAllIdentifiers.json.xzAllIdentifiers.json.zip

> ### AllPrices [​](#allprices)
>
> File containing all prices of cards in various formats organized by a card's `uuid` property for the past 90 days. See the [Price Formats](/data-models/price/price-formats/) Data Model for the model of returned data.
>
> Select a file to downloadAllPrices.jsonAllPrices.json.bz2AllPrices.json.gzAllPrices.json.xzAllPrices.json.zip

> ### AllPricesToday [​](#allpricestoday)
>
> File containing all prices, **for the current day**, of cards in various formats organized by a card's `uuid` property. See the [Price Formats](/data-models/price/price-formats/) Data Model for the model of returned data.
>
> Select a file to downloadAllPricesToday.jsonAllPricesToday.json.bz2AllPricesToday.json.gzAllPricesToday.json.xzAllPricesToday.json.zip

> ### AllSetFiles [​](#allsetfiles)
>
> File containing a directory of all individual [Set](/data-models/set/) data, compressed.
>
> Select a file to downloadAllSetFiles.zipAllSetFiles.tar.bz2AllSetFiles.tar.gzAllSetFiles.tar.xzAllSetFiles.tar.zip

> ### AtomicCards [​](#atomiccards)
>
> File containing every [Card (Atomic)](/data-models/card/card-atomic/) card organized by the card's [name](/data-models/card/card-atomic/#name) property.
>
> Select a file to downloadAtomicCards.jsonAtomicCards.json.bz2AtomicCards.json.gzAtomicCards.json.xzAtomicCards.json.zip

> ### CardTypes [​](#cardtypes)
>
> File containing every card type of any type of card, defined by the [Card Types](/data-models/card-types/) Data Model.
>
> Select a file to downloadCardTypes.jsonCardTypes.json.bz2CardTypes.json.gzCardTypes.json.xzCardTypes.json.zip

> ### CompiledList [​](#compiledlist)
>
> File containing all filename outputs by the MTGJSON application, such as `AllPrintings`, `CardTypes`, etc.
>
> **Note:** This file does not contain data for these outputs, only string references to their existence. Generally, this data is used for documentation, but is also available to the public.
>
> Select a file to downloadCompiledList.jsonCompiledList.json.bz2CompiledList.json.gzCompiledList.json.xzCompiledList.json.zip

> ### DeckList [​](#decklist)
>
> File containing a list of all individual Deck's "meta data" based on the [Deck List](/data-models/deck-list/) Data Model.
>
> Select a file to downloadDeckList.jsonDeckList.json.bz2DeckList.json.gzDeckList.json.xzDeckList.json.zip

> ### EnumValues [​](#enumvalues)
>
> File containing known property values for various Data Models.
>
> **Note:** Generally, this data is used for documentation, but is also available to the public.
>
> Select a file to downloadEnumValues.jsonEnumValues.json.bz2EnumValues.json.gzEnumValues.json.xzEnumValues.json.zip

> ### Keywords [​](#keywords)
>
> File containing a list of possible all keywords used on all cards, using the [Keywords](/data-models/keywords/) Data Model
>
> Select a file to downloadKeywords.jsonKeywords.json.bz2Keywords.json.gzKeywords.json.xzKeywords.json.zip

> ### Legacy [​](#legacy)
>
> File containing all sets using the [Set](/data-models/set/) Data Model which includes all printings and variations of the [Card (Set)](/data-models/card/card-set/) Data Model, categorized by a Set's [code](/data-models/set/#code) property, restricted to sets legal in the Legacy play format.
>
> Select a file to downloadLegacy.jsonLegacy.json.bz2Legacy.json.gzLegacy.json.xzLegacy.json.zip

> ### LegacyAtomic [​](#legacyatomic)
>
> File containing every [Card (Atomic)](/data-models/card/card-atomic/) card organized by the card's [name](/data-models/card/card-atomic/#name) property, restricted to cards legal in the Legacy play format.
>
> Select a file to downloadLegacyAtomic.jsonLegacyAtomic.json.bz2LegacyAtomic.json.gzLegacyAtomic.json.xzLegacyAtomic.json.zip

> ### Meta [​](#meta)
>
> File containing the metadata object with [ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html) dates for latest build and [SemVer](https://semver.org/) specifications of the MTGJSON release.
>
> Select a file to downloadMeta.jsonMeta.json.bz2Meta.json.gzMeta.json.xzMeta.json.zip

> ### Modern [​](#modern)
>
> File containing all sets using the [Set](/data-models/set/) Data Model which includes all printings and variations of the [Card (Set)](/data-models/card/card-set/) Data Model, categorized by a Set's [code](/data-models/set/#code) property, restricted to sets legal in the Modern play format.
>
> Select a file to downloadModern.jsonModern.json.bz2Modern.json.gzModern.json.xzModern.json.zip

> ### ModernAtomic [​](#modernatomic)
>
> File containing every [Card (Atomic)](/data-models/card/card-atomic/) card organized by the card's [name](/data-models/card/card-atomic/#name) property, restricted to cards legal in the Modern play format.
>
> Select a file to downloadModernAtomic.jsonModernAtomic.json.bz2ModernAtomic.json.gzModernAtomic.json.xzModernAtomic.json.zip

> ### PauperAtomic [​](#pauperatomic)
>
> File containing every [Card (Atomic)](/data-models/card/card-atomic/) card organized by the card's [name](/data-models/card/card-atomic/#name) property, restricted to cards legal in the Pauper play format.
>
> Select a file to downloadPauperAtomic.jsonPauperAtomic.json.bz2PauperAtomic.json.gzPauperAtomic.json.xzPauperAtomic.json.zip

> ### Pioneer [​](#pioneer)
>
> File containing all sets using the [Set](/data-models/set/) Data Model which includes all printings and variations of the [Card (Set)](/data-models/card/card-set/) Data Model, categorized by a Set's [code](/data-models/set/#code) property, restricted to sets legal in the Pioneer play format.
>
> Select a file to downloadPioneer.jsonPioneer.json.bz2Pioneer.json.gzPioneer.json.xzPioneer.json.zip

> ### PioneerAtomic [​](#pioneeratomic)
>
> File containing every [Card (Atomic)](/data-models/card/card-atomic/) card organized by the card's [name](/data-models/card/card-atomic/#name) property, restricted to cards legal in the Pioneer play format.
>
> Select a file to downloadPioneerAtomic.jsonPioneerAtomic.json.bz2PioneerAtomic.json.gzPioneerAtomic.json.xzPioneerAtomic.json.zip

> ### SetList [​](#setlist)
>
> File containing a list of meta data for all [Set](/data-models/set/) data using the [Set List](/data-models/set-list/) Data Model.
>
> Select a file to downloadSetList.jsonSetList.json.bz2SetList.json.gzSetList.json.xzSetList.json.zip

> ### Standard [​](#standard)
>
> File containing all sets using the [Set](/data-models/set/) Data Model which includes all printings and variations of the [Card (Set)](/data-models/card/card-set/) Data Model, categorized by a Set's [code](/data-models/set/#code) property, restricted to sets legal in the Standard play format.
>
> Select a file to downloadStandard.jsonStandard.json.bz2Standard.json.gzStandard.json.xzStandard.json.zip

> ### StandardAtomic [​](#standardatomic)
>
> File containing every [Card (Atomic)](/data-models/card/card-atomic/) card organized by the card's [name](/data-models/card/card-atomic/#name) property, restricted to cards legal in the Standard play format.
>
> Select a file to downloadStandardAtomic.jsonStandardAtomic.json.bz2StandardAtomic.json.gzStandardAtomic.json.xzStandardAtomic.json.zip

> ### TcgplayerSkus [​](#tcgplayerskus)
>
> File containing [TCGplayer](https://www.tcgplayer.com/?partner=mtgjson&utm_campaign=affiliate&utm_medium=mtgjson&utm_source=mtgjson) SKU information based on a card's `uuid` property.
>
> Select a file to downloadTcgplayerSkus.jsonTcgplayerSkus.json.bz2TcgplayerSkus.json.gzTcgplayerSkus.json.xzTcgplayerSkus.json.zip

> ### Vintage [​](#vintage)
>
> File containing all sets using the [Set](/data-models/set/) Data Model which includes all printings and variations of the [Card (Set)](/data-models/card/card-set/) Data Model, categorized by a Set's [code](/data-models/set/#code) property, restricted to sets legal in the Vintage play format.
>
> Select a file to downloadVintage.jsonVintage.json.bz2Vintage.json.gzVintage.json.xzVintage.json.zip

> ### VintageAtomic [​](#vintageatomic)
>
> File containing every [Card (Atomic)](/data-models/card/card-atomic/) card organized by the card's [name](/data-models/card/card-atomic/#name) property, restricted to cards legal in the Vintage play format.
>
> Select a file to downloadVintageAtomic.jsonVintageAtomic.json.bz2VintageAtomic.json.gzVintageAtomic.json.xzVintageAtomic.json.zip