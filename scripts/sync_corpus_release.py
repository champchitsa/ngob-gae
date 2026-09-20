"""Upload a validated corpus to a draft GitHub release and verify every asset.

This command never publishes a release. It refuses to upload to a release that
is not a draft and verifies names, sizes, and GitHub-provided SHA-256 digests.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import time

from corpus_pipeline import atomic_write_json, collect_record_assets, sha256_file


ASSET_NAME = re.compile(r"^[A-Za-z0-9_-]+\.jsonl\.gz$")


def run_gh(arguments: list[str]) -> str:
    result = subprocess.run(
        ["gh", *arguments],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode:
        message = result.stderr.strip() or result.stdout.strip() or f"gh exited {result.returncode}"
        raise RuntimeError(message)
    return result.stdout


def load_release(repo: str, tag: str) -> dict:
    payload = run_gh(["release", "view", tag, "--repo", repo, "--json", "tagName,isDraft,isPrerelease,url,assets"])
    return json.loads(payload)


def validation_gate(report: dict, expected_ids: set[str], local_metadata: dict[str, dict]) -> list[str]:
    failures = []
    expected_count = len(expected_ids)
    for key in ("inventory_files", "assets", "valid"):
        if int(report.get(key) or 0) != expected_count:
            failures.append(f"validation {key} is {report.get(key)!r}, expected {expected_count}")
    for key in ("missing", "invalid", "conflicting_duplicates", "unexpected", "unreviewed_warning_files", "unused_review_entries"):
        if report.get(key):
            failures.append(f"validation {key} is not empty")

    results = {str(item.get("id")): item for item in report.get("results", [])}
    if set(results) != expected_ids:
        failures.append("validation result ids do not exactly match the inventory")
        return failures
    for file_id, metadata in local_metadata.items():
        result = results[file_id]
        if int(result.get("bytes") or -1) != metadata["size"]:
            failures.append(f"asset changed after validation: {file_id} size")
            continue
        if str(result.get("sha256") or "").lower() != metadata["sha256"]:
            failures.append(f"asset changed after validation: {file_id} sha256")
    return failures


def compare_release_assets(expected: dict[str, dict], release_assets: list[dict]) -> dict:
    by_name: dict[str, list[dict]] = {}
    for asset in release_assets:
        by_name.setdefault(str(asset.get("name") or ""), []).append(asset)
    duplicates = sorted(name for name, values in by_name.items() if len(values) != 1)
    actual_names = set(by_name)
    expected_names = set(expected)
    missing = sorted(expected_names - actual_names)
    unexpected = sorted(actual_names - expected_names)
    invalid_names = sorted(name for name in actual_names if not ASSET_NAME.fullmatch(name))
    size_mismatches = []
    digest_mismatches = []
    digest_pending = []
    state_mismatches = []
    for name in sorted(expected_names & actual_names):
        asset = by_name[name][0]
        wanted = expected[name]
        if int(asset.get("size") or -1) != wanted["size"]:
            size_mismatches.append(name)
        digest = str(asset.get("digest") or "")
        if not digest:
            digest_pending.append(name)
        elif digest.lower() != f"sha256:{wanted['sha256']}":
            digest_mismatches.append(name)
        if asset.get("state") != "uploaded":
            state_mismatches.append(name)
    return {
        "expected": len(expected_names),
        "actual": len(release_assets),
        "unique_names": len(actual_names),
        "missing": missing,
        "unexpected": unexpected,
        "duplicates": duplicates,
        "invalid_names": invalid_names,
        "size_mismatches": size_mismatches,
        "digest_mismatches": digest_mismatches,
        "digest_pending": digest_pending,
        "state_mismatches": state_mismatches,
    }


def comparison_passed(comparison: dict) -> bool:
    return all(
        not comparison[key]
        for key in (
            "missing",
            "unexpected",
            "duplicates",
            "invalid_names",
            "size_mismatches",
            "digest_mismatches",
            "digest_pending",
            "state_mismatches",
        )
    )


def batches(values: list[pathlib.Path], size: int):
    for index in range(0, len(values), size):
        yield values[index:index + size]


def upload_batches(repo: str, tag: str, paths: list[pathlib.Path], batch_size: int, *, clobber: bool) -> None:
    for number, batch in enumerate(batches(paths, batch_size), start=1):
        command = ["release", "upload", tag, *[str(path) for path in batch], "--repo", repo]
        if clobber:
            command.append("--clobber")
        run_gh(command)
        print(f"uploaded batch {number}: {len(batch)} assets", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=pathlib.Path)
    parser.add_argument("validation_report", type=pathlib.Path)
    parser.add_argument("corpus_dirs", nargs="+", type=pathlib.Path)
    parser.add_argument("--repo", default="champchitsa/ngob-gae")
    parser.add_argument("--tag", default="corpus-v1")
    parser.add_argument("--duplicate-precedence", choices=["first", "last"], default="first")
    parser.add_argument("--batch-size", type=int, default=25)
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--replace-mismatched", action="store_true")
    parser.add_argument("--verify-retries", type=int, default=10)
    parser.add_argument("--verify-delay", type=float, default=3.0)
    parser.add_argument("--report", type=pathlib.Path)
    args = parser.parse_args()

    if not 1 <= args.batch_size <= 50:
        raise ValueError("batch size must be between 1 and 50")
    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    expected_ids = {str(item["id"]) for item in inventory["files"]}
    if len(expected_ids) != len(inventory["files"]):
        raise RuntimeError("inventory contains duplicate ids")
    local_assets, identical_duplicates, conflicting_duplicates = collect_record_assets(
        args.corpus_dirs, precedence=args.duplicate_precedence
    )
    if conflicting_duplicates:
        raise RuntimeError(f"conflicting duplicate corpus assets: {', '.join(sorted(conflicting_duplicates))}")
    missing_local = sorted(expected_ids - set(local_assets))
    unexpected_local = sorted(set(local_assets) - expected_ids)
    if missing_local or unexpected_local:
        raise RuntimeError(f"local corpus mismatch: missing={len(missing_local)}, unexpected={len(unexpected_local)}")

    local_metadata = {
        file_id: {"path": path, "size": path.stat().st_size, "sha256": sha256_file(path)}
        for file_id, path in local_assets.items()
    }
    validation = json.loads(args.validation_report.read_text(encoding="utf-8"))
    failures = validation_gate(validation, expected_ids, local_metadata)
    if failures:
        raise RuntimeError("release blocked by validation: " + "; ".join(failures[:20]))

    expected = {f"{file_id}.jsonl.gz": metadata for file_id, metadata in local_metadata.items()}
    release = load_release(args.repo, args.tag)
    if not release.get("isDraft"):
        raise RuntimeError("release upload is allowed only while the release is a draft")
    comparison = compare_release_assets(expected, release.get("assets") or [])

    if args.upload:
        if comparison["unexpected"] or comparison["duplicates"] or comparison["invalid_names"]:
            raise RuntimeError("release contains unexpected, duplicate, or invalid asset names; review it manually")
        upload_batches(args.repo, args.tag, [expected[name]["path"] for name in comparison["missing"]], args.batch_size, clobber=False)
        mismatched = sorted(set(comparison["size_mismatches"] + comparison["digest_mismatches"]))
        if mismatched:
            if not args.replace_mismatched:
                raise RuntimeError("release has mismatched assets; rerun with --replace-mismatched after review")
            upload_batches(args.repo, args.tag, [expected[name]["path"] for name in mismatched], args.batch_size, clobber=True)

        for attempt in range(max(1, args.verify_retries)):
            release = load_release(args.repo, args.tag)
            comparison = compare_release_assets(expected, release.get("assets") or [])
            if comparison_passed(comparison):
                break
            if attempt + 1 < args.verify_retries:
                time.sleep(max(0, args.verify_delay))

    payload = {
        "repo": args.repo,
        "tag": args.tag,
        "release_url": release.get("url"),
        "draft": release.get("isDraft"),
        "inventory_files": len(expected_ids),
        "local_assets": len(local_assets),
        "identical_duplicate_files": len(identical_duplicates),
        "comparison": comparison,
        "verified": comparison_passed(comparison),
        "published": False,
    }
    if args.report:
        atomic_write_json(args.report, payload, indent=2)
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if not payload["verified"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
