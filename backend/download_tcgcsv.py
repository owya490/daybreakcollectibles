import json
import time
import urllib.request
from bdb import Breakpoint
from pathlib import Path

CATEGORY_ID = "3"
OUT_DIR = Path(__file__).resolve().parent / "tcgcsv"
USER_AGENT = "DaybreakCollectibles/1.0"
SLEEP_SECONDS = 0.25


def get_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    groups_payload = get_json(f"https://tcgcsv.com/tcgplayer/{CATEGORY_ID}/groups")
    (OUT_DIR / "pokemon.json").write_text(json.dumps(groups_payload, indent=2) + "\n")
    groups = groups_payload["results"]

    for index, group in enumerate(groups, start=1):
        group_id = group["groupId"]
        destination = OUT_DIR / f"{group_id}.json"
        if destination.exists():
            print(f"[{index}/{len(groups)}] skip {group_id}", flush=True)
            continue

        products_payload = get_json(
            f"https://tcgcsv.com/tcgplayer/{CATEGORY_ID}/{group_id}/products"
        )
        destination.write_text(json.dumps(products_payload, indent=2) + "\n")
        product_count = products_payload.get(
            "totalItems", len(products_payload.get("results", []))
        )
        print(
            f"[{index}/{len(groups)}] {group_id} {group.get('name')} ({product_count} products)",
            flush=True,
        )
        time.sleep(SLEEP_SECONDS)


if __name__ == "__main__":
    main()
