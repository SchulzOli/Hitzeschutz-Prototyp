#!/usr/bin/env bash
# Extrahiert Kühle Orte aus einem Geofabrik-OSM-Extrakt und schreibt statische
# Kacheln. Läuft in GitHub Actions (siehe .github/workflows/deploy.yml), lokal
# z. B. unter Linux/WSL mit installiertem osmium-tool:
#   bash scripts/osm-extrahieren.sh europe/germany/bremen
# Siehe docs/adr/0004-openstreetmap-als-basisquelle.md.
set -euo pipefail

REGION="${1:-europe/germany}"
ZIEL="${2:-public/kuehle-orte/osm}"
ARBEIT="$(mktemp -d)"
trap 'rm -rf "$ARBEIT"' EXIT

if ! command -v osmium >/dev/null; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq osmium-tool
fi

echo "Lade Geofabrik-Extrakt ${REGION} …"
curl -fsSL --retry 3 -A "Hitzeschutz-Prototyp (github.com/SchulzOli/Hitzeschutz-Prototyp)" \
  -o "$ARBEIT/region.osm.pbf" "https://download.geofabrik.de/${REGION}-latest.osm.pbf"
ls -lh "$ARBEIT/region.osm.pbf"

STAND="$(osmium fileinfo -g header.option.osmosis_replication_timestamp "$ARBEIT/region.osm.pbf" 2>/dev/null || true)"
STAND="${STAND%%T*}"

echo "Filtere relevante Objekte …"
osmium tags-filter "$ARBEIT/region.osm.pbf" \
  nwr/amenity=drinking_water,library,place_of_worship \
  nwr/tourism=museum \
  nwr/leisure=park,bathing_place,swimming_area,water_park,sports_centre \
  -o "$ARBEIT/gefiltert.osm.pbf"
rm "$ARBEIT/region.osm.pbf"

echo "Exportiere Geometrien …"
osmium export "$ARBEIT/gefiltert.osm.pbf" -f geojsonseq --attributes=type,id \
  -o "$ARBEIT/orte.geojsonseq"

node scripts/osm-kacheln.mjs "$ARBEIT/orte.geojsonseq" "$ZIEL" "${STAND:-$(date -u +%F)}"
du -sh "$ZIEL"
