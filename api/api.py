from __future__ import annotations

import json
import logging
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from .config_resolver import ConfigResolverError
from .pipeline import PipelineService
from .project_store import ProjectStore, ProjectStoreError
from .schemas import (
    CmsGenerationRecord,
    CmsGenerationUpdateRequest,
    GenerateRequest,
    GenerationResponse,
    ImportWebRequest,
    ImportWebResponse,
    ManifestUpdateRequest,
    ProcessRequest,
    UploadResponse,
)

logger = logging.getLogger(__name__)


@dataclass
class AppState:
    store: ProjectStore
    pipeline: PipelineService
    app_base_url: str


router = APIRouter(prefix="/api")


def get_state(request: Request) -> AppState:
    state: AppState | None = getattr(request.app.state, "app_state", None)
    if state is None:
        raise RuntimeError("Application state not initialized")
    return state


def _save_uploaded_file(
    state: AppState,
    project_id: str,
    file: UploadFile,
    upload_kind: str,
) -> UploadResponse:
    suffix = Path(file.filename or "upload.bin").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file.file.read())
        tmp_path = Path(tmp.name)

    try:
        saved = state.store.save_upload(project_id, "working/uploads", tmp_path, file.filename or upload_kind)
        project_relative_path = state.store.rel_to_project(project_id, saved)
        return UploadResponse(
            path=project_relative_path,
            url=f"{state.app_base_url}/projects/{project_id}/files/{project_relative_path}",
        )
    except ProjectStoreError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        tmp_path.unlink(missing_ok=True)


@router.get("/projects")
def list_projects(state: AppState = Depends(get_state)) -> dict:
    return {"projects": state.store.list_projects()}


@router.get("/projects/{project_id}")
def get_project(project_id: str, state: AppState = Depends(get_state)) -> dict:
    try:
        state.store.ensure_layout(project_id)
        article = state.store.load_article(project_id).model_dump(mode="json", exclude_none=True)
        manifest = state.store.load_generation_manifest(project_id).model_dump(
            mode="json", exclude_none=True
        )
    except ProjectStoreError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    project_dir = state.store.project_path(project_id)
    has_manuscript = (project_dir / "working/manuscript.json").exists()
    has_processed = (project_dir / "output/processed_manuscript.json").exists()

    return {
        "project_id": project_id,
        "manifest": manifest,
        "article": article,
        "has_manuscript": has_manuscript,
        "has_processed": has_processed,
    }


@router.post("/projects/{project_id}/generate", response_model=GenerationResponse)
def generate_project(
    project_id: str,
    payload: GenerateRequest,
    state: AppState = Depends(get_state),
) -> GenerationResponse:
    logger.info("[api] /generate started for project '%s'", project_id)
    try:
        manuscript = state.pipeline.generate_manuscript(
            project_id,
            script_prompt_override=payload.script_prompt,
            target_duration_seconds=payload.target_duration_seconds,
        )
    except ProjectStoreError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ConfigResolverError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    logger.info(
        "[api] /generate finished for project '%s' (segments=%d)",
        project_id,
        len(manuscript.segments),
    )
    return GenerationResponse(
        project_id=project_id,
        status="generated",
        manuscript_json=manuscript.model_dump(mode="json", exclude_none=True),
        processed_json=None,
    )


@router.post("/projects/{project_id}/process", response_model=GenerationResponse)
def process_project(
    project_id: str,
    payload: ProcessRequest,
    state: AppState = Depends(get_state),
) -> GenerationResponse:
    try:
        processed = state.pipeline.process_manuscript(project_id, payload.manuscript, voice_id=payload.voice_id)
    except ProjectStoreError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ConfigResolverError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GenerationResponse(
        project_id=project_id,
        status="processed",
        manuscript_json=None,
        processed_json=processed.model_dump(mode="json", exclude_none=True),
    )


@router.post("/projects/{project_id}/upload-image", response_model=UploadResponse)
def upload_image(
    project_id: str,
    file: UploadFile = File(...),
    state: AppState = Depends(get_state),
) -> UploadResponse:
    return _save_uploaded_file(state=state, project_id=project_id, file=file, upload_kind="image")


@router.post("/projects/{project_id}/upload-audio", response_model=UploadResponse)
def upload_audio(
    project_id: str,
    file: UploadFile = File(...),
    state: AppState = Depends(get_state),
) -> UploadResponse:
    return _save_uploaded_file(state=state, project_id=project_id, file=file, upload_kind="audio")


@router.get("/projects/{project_id}/article")
def get_project_article(project_id: str, state: AppState = Depends(get_state)) -> dict:
    try:
        article = state.store.load_article(project_id)
        return article.model_dump(mode="json", exclude_none=True)
    except ProjectStoreError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _parse_project_id_from_output(stdout: str, stderr: str) -> str | None:
    combined = f"{stdout}\n{stderr}"
    direct = re.search(r"Created project:\s*([A-Za-z0-9][A-Za-z0-9._-]*)", combined)
    if direct:
        return direct.group(1)
    from_path = re.search(r"/projects/([A-Za-z0-9][A-Za-z0-9._-]*)", combined)
    if from_path:
        return from_path.group(1)
    return None


@router.post("/import/web", response_model=ImportWebResponse)
def import_web(payload: ImportWebRequest, state: AppState = Depends(get_state)) -> ImportWebResponse:
    fetcher_script = Path(__file__).parent.parent / "fetchers" / "web" / "fetcher.py"
    if not fetcher_script.exists():
        raise HTTPException(status_code=500, detail="Web fetcher script not found")

    projects_root = str(state.store.root)
    result = subprocess.run(
        [
            sys.executable,
            str(fetcher_script),
            payload.url,
            "--projects-root",
            projects_root,
            "--force",
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )

    stdout = result.stdout or ""
    stderr = result.stderr or ""

    if result.returncode != 0:
        detail = (stderr or stdout or "Fetcher failed").strip()
        raise HTTPException(status_code=400, detail=f"Fetcher failed: {detail}")

    project_id = _parse_project_id_from_output(stdout, stderr)
    if not project_id:
        raise HTTPException(status_code=500, detail="Could not determine project id from fetcher output")

    try:
        manifest = state.store.load_generation_manifest(project_id)
        manifest.brandId = payload.brand_id
        manifest.promptPack = payload.brand_id
        manifest.voicePack = payload.brand_id
        state.store.save_generation_manifest(manifest)
    except Exception as exc:
        logger.warning("[api] could not update manifest for %s: %s", project_id, exc)

    return ImportWebResponse(project_id=project_id, stdout=stdout, stderr=stderr)


@router.patch("/projects/{project_id}/manifest")
def update_project_manifest(
    project_id: str,
    payload: ManifestUpdateRequest,
    state: AppState = Depends(get_state),
) -> dict:
    try:
        manifest = state.store.load_generation_manifest(project_id)
    except ProjectStoreError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    manifest.brandId = payload.brandId
    manifest.promptPack = payload.brandId
    manifest.voicePack = payload.brandId
    state.store.save_generation_manifest(manifest)
    return manifest.model_dump(mode="json")


@router.get("/projects/{project_id}/manifest")
def get_project_manifest(project_id: str, state: AppState = Depends(get_state)) -> dict:
    try:
        manifest = state.store.load_generation_manifest(project_id)
        return manifest.model_dump(mode="json")
    except ProjectStoreError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/cms-generations")
def create_cms_generation(payload: CmsGenerationRecord, state: AppState = Depends(get_state)) -> dict:
    try:
        state.store.ensure_layout(payload.projectId)
    except ProjectStoreError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    gen_path = state.store.project_path(payload.projectId) / "working" / "cms-generation.json"
    gen_path.write_text(payload.model_dump_json(), encoding="utf-8")
    return {"id": payload.id}


@router.get("/cms-generations")
def get_cms_generation(id: str, state: AppState = Depends(get_state)) -> dict:
    if not re.match(r"^[A-Za-z0-9][A-Za-z0-9._-]*$", id):
        raise HTTPException(status_code=400, detail="Invalid generation id")

    try:
        gen_path = state.store.project_path(id) / "working" / "cms-generation.json"
    except ProjectStoreError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not gen_path.exists():
        raise HTTPException(status_code=404, detail="Generation not found")

    return json.loads(gen_path.read_text(encoding="utf-8"))


@router.put("/cms-generations")
def update_cms_generation(payload: CmsGenerationUpdateRequest, id: str, state: AppState = Depends(get_state)) -> dict:
    if not re.match(r"^[A-Za-z0-9][A-Za-z0-9._-]*$", id):
        raise HTTPException(status_code=400, detail="Invalid generation id")

    try:
        gen_path = state.store.project_path(id) / "working" / "cms-generation.json"
    except ProjectStoreError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not gen_path.exists():
        raise HTTPException(status_code=404, detail="Generation not found")

    existing = json.loads(gen_path.read_text(encoding="utf-8"))
    existing["data"] = payload.data
    existing["updatedAt"] = datetime.now(timezone.utc).isoformat()
    gen_path.write_text(json.dumps(existing), encoding="utf-8")
    return {"success": True}


def create_files_router(state: AppState) -> APIRouter:
    files_router = APIRouter()

    @files_router.get("/projects/{project_id}/files/{file_path:path}")
    def project_file(project_id: str, file_path: str):
        try:
            path = state.store.resolve_asset_path(project_id, file_path)
            return FileResponse(path)
        except ProjectStoreError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    return files_router
