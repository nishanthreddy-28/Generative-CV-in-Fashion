"""Prepare source for review/upload; does not publish or include local data/secrets."""
from pathlib import Path
import shutil
import argparse

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, default=root / "storage/space-bundle")
out = parser.parse_args().output.resolve()
if root.is_relative_to(out) or any(out.is_relative_to(root / directory) for directory in ["app", "scripts", "deployment", "web"]):
    parser.error("Choose an output directory outside the source folders")
out.mkdir(exist_ok=False)
for directory in ["app", "scripts", "deployment", "web"]:
    shutil.copytree(root / directory, out / directory, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
shutil.copy(root / "deployment/cloud/requirements.txt", out / "requirements.txt")
shutil.copy(root / "deployment/cloud/SPACE_README.md", out / "README.md")
print(f"Prepared {out}. No wardrobe data, weights, environments or keys included.")
