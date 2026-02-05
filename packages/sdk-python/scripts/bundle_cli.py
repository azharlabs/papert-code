import os
import shutil
import subprocess
from pathlib import Path


def run(cmd: list[str], cwd: Path) -> None:
    result = subprocess.run(cmd, cwd=str(cwd), check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(cmd)}")


def ensure_root_bundle(repo_root: Path) -> None:
    root_dist = repo_root / "dist"
    root_cli = root_dist / "cli.js"
    if root_cli.exists():
        return
    print("[sdk-python prepack] Root CLI bundle missing; running `npm run bundle`")
    npm = "npm.cmd" if os.name == "nt" else "npm"
    run([npm, "run", "bundle"], repo_root)


def copy_if_exists(source: Path, target: Path) -> None:
    if not source.exists():
        return
    if source.is_dir():
        shutil.copytree(source, target)
    else:
        shutil.copy2(source, target)


def main() -> None:
    sdk_root = Path(__file__).resolve().parent.parent
    repo_root = sdk_root.parent.parent

    ensure_root_bundle(repo_root)

    root_dist = repo_root / "dist"
    root_cli = root_dist / "cli.js"
    if not root_cli.exists():
        raise FileNotFoundError("[sdk-python prepack] Root CLI bundle not found after build")

    target_dir = sdk_root / "src" / "papert_code_sdk" / "cli"
    if target_dir.exists():
        shutil.rmtree(target_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    print("[sdk-python prepack] Copying CLI bundle into SDK package...")
    shutil.copy2(root_cli, target_dir / "cli.js")

    vendor_source = root_dist / "vendor"
    copy_if_exists(vendor_source, target_dir / "vendor")

    for entry in root_dist.iterdir():
        if entry.suffix == ".sb":
            shutil.copy2(entry, target_dir / entry.name)

    print("[sdk-python prepack] CLI bundle copied successfully")


if __name__ == "__main__":
    main()
