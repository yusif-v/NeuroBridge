"""Bounded extraction only. Uploaded executables are never started on the host."""
from pathlib import Path, PurePosixPath
import stat
import struct
import zipfile

from fastapi import HTTPException

MAX_EXPANDED = 1024 * 1024 * 1024
MAX_FILES = 5000


def safe_name(name: str) -> PurePosixPath:
    name = name.replace('\\', '/')
    path = PurePosixPath(name)
    if (not name or path.is_absolute() or any(p in ('.', '..') or ':' in p for p in name.split('/'))
            or any(ord(c) < 32 for c in name)
            or any(p.endswith(('.', ' ')) for p in path.parts)
            or any(p.split('.')[0].upper() in {'CON','PRN','AUX','NUL',*[f'COM{i}' for i in range(1,10)],*[f'LPT{i}' for i in range(1,10)]} for p in path.parts)):
        raise HTTPException(422, 'Archive contains an unsafe path')
    return path


def validate_pe(path: Path):
    with path.open('rb') as source:
        header = source.read(64)
        if len(header) < 64 or header[:2] != b'MZ':
            raise HTTPException(422, 'Entrypoint is not a Windows executable')
        offset = struct.unpack_from('<I', header, 60)[0]
        if offset > 1024 * 1024:
            raise HTTPException(422, 'Invalid executable header')
        source.seek(offset)
        pe = source.read(6)
    if pe[:4] != b'PE\x00\x00' or len(pe) != 6:
        raise HTTPException(422, 'Invalid PE executable')
    if struct.unpack_from('<H', pe, 4)[0] != 0x8664:
        raise HTTPException(422, 'This worker supports 64-bit Windows builds (x86_64)')


def validate_executable(path: Path):
    with path.open('rb') as source:
        header = source.read(64)
    if header[:4] == b'\x7fELF':
        if len(header) < 64 or header[4:7] != b'\x02\x01\x01' or struct.unpack_from('<HH', header, 16) not in ((2,62), (3,62)):
            raise HTTPException(422, 'Linux entrypoint must be an x86_64 ELF executable')
        return 'Linux native'
    validate_pe(path)
    return 'Windows / Wine'


def is_entrypoint(path: Path):
    if path.suffix.lower() == '.exe':
        return True
    if path.suffix.lower() in ('', '.x86_64', '.bin'):
        with path.open('rb') as source:
            return source.read(4) == b'\x7fELF'
    return False


def prepare_build(archive: Path, build: Path, filename: str, entrypoint: str = '') -> str:
    build.mkdir(parents=True, exist_ok=True)
    if filename.lower().endswith(('.exe', '.x86_64', '.bin')):
        target = build / ('game.exe' if filename.lower().endswith('.exe') else safe_name(filename).name)
        archive.replace(target)
    elif filename.lower().endswith('.zip'):
        try:
            with zipfile.ZipFile(archive) as bundle:
                infos = bundle.infolist()
                if len(infos) > MAX_FILES or sum(i.file_size for i in infos) > MAX_EXPANDED:
                    raise HTTPException(413, 'Archive is too large after extraction')
                seen = set()
                for info in infos:
                    name = info.filename.rstrip('/')
                    path = safe_name(name)
                    mode = info.external_attr >> 16
                    if stat.S_ISLNK(mode) or (stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR)):
                        raise HTTPException(422, 'Archive links and special files are not accepted')
                    normalized = str(path).casefold()
                    if normalized in seen:
                        raise HTTPException(422, 'Archive contains duplicate paths')
                    seen.add(normalized)
                    dest = build.joinpath(*path.parts)
                    if not dest.resolve().is_relative_to(build.resolve()):
                        raise HTTPException(422, 'Archive path escapes the build')
                    if info.is_dir():
                        dest.mkdir(parents=True, exist_ok=True)
                        continue
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    written = 0
                    with bundle.open(info) as src, dest.open('wb') as out:
                        while chunk := src.read(1024 * 1024):
                            written += len(chunk)
                            if written > info.file_size or written > MAX_EXPANDED:
                                raise HTTPException(413, 'Archive expansion limit exceeded')
                            out.write(chunk)
        except (zipfile.BadZipFile, RuntimeError, NotImplementedError) as exc:
            raise HTTPException(422, 'Invalid or encrypted ZIP archive') from exc
        candidates = sorted(p for p in build.rglob('*') if p.is_file() and is_entrypoint(p))
        if entrypoint:
            target = build.joinpath(*safe_name(entrypoint).parts)
            if not target.is_file() or target not in candidates:
                raise HTTPException(422, 'Specified executable entrypoint does not exist in the ZIP')
        elif len(candidates) == 1:
            target = candidates[0]
        else:
            names = [p.relative_to(build).as_posix() for p in candidates[:20]]
            raise HTTPException(422, f'ZIP needs exactly one executable, or specify its relative path. Found: {names}')
    else:
        raise HTTPException(415, 'Upload a Linux/Windows build ZIP or x86_64 executable')
    validate_executable(target)
    return target.relative_to(build).as_posix()
