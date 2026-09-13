import os
import time
import uuid
import logging
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional

from PIL import Image, ImageDraw

logger = logging.getLogger(__name__)


# ============================================================
# PATHS
# ============================================================

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEFAULT_MODEL_PATH = os.path.join(
    BACKEND_DIR,
    "ai",
    "weights",
    "best.pt",
)

EXPECTED_CLASS_NAMES = {
    0: "helmet",
    1: "gloves",
    2: "vest",
    3: "boots",
    4: "goggles",
    5: "none",
    6: "Person",
    7: "no_helmet",
    8: "no_goggle",
    9: "no_gloves",
    10: "no_boots",
}

UPLOAD_AI_DIR = os.path.join(
    BACKEND_DIR,
    "uploads",
    "ai",
)

os.makedirs(UPLOAD_AI_DIR, exist_ok=True)


# ============================================================
# BOUNDING BOX COLORS
# ============================================================

COLOR_MAP = {
    # Violations
    "no_helmet": (239, 68, 68),
    "no_gloves": (249, 115, 22),
    "no_boots": (245, 158, 11),
    "no_goggle": (234, 88, 12),

    # PPE compliance
    "helmet": (34, 197, 94),
    "vest": (16, 185, 129),
    "gloves": (6, 182, 212),
    "boots": (20, 184, 166),
    "goggles": (59, 130, 246),

    # Person
    "person": (99, 102, 241),

    # Other
    "none": (148, 163, 184),
    "default": (148, 163, 184),
}


# ============================================================
# YOLO SERVICE
# ============================================================

class YOLOService:

    _instance: Optional["YOLOService"] = None

    def __init__(self):

        self.model = None

        # ----------------------------------------------------
        # Configuration
        # ----------------------------------------------------

        self.model_path = os.getenv(
            "PPE_MODEL_PATH",
            DEFAULT_MODEL_PATH,
        )

        self.confidence_threshold = float(
            os.getenv("PPE_CONFIDENCE", "0.40")
        )

        self.iou_threshold = float(
            os.getenv("PPE_IOU", "0.50")
        )

        self.image_size = int(
            os.getenv("PPE_IMGSZ", "640")
        )

        self.device = os.getenv(
            "PPE_DEVICE",
            "auto",
        )
        self.selected_device = self._resolve_device()

        # ----------------------------------------------------
        # Model metadata
        # ----------------------------------------------------

        self.model_name = "finetuned-safetyvision-ppe"
        self.model_version = "v2"

        self.loaded_path = None
        self.parameter_count: Optional[int] = None
        self.model_sha256: Optional[str] = None
        self.loaded_at: Optional[datetime] = None

        # Load model once when service starts
        self._load_model()


    # ========================================================
    # SINGLETON
    # ========================================================

    @classmethod
    def get_instance(cls) -> "YOLOService":

        if cls._instance is None:
            cls._instance = cls()

        return cls._instance


    # ========================================================
    # DEVICE
    # ========================================================

    def _resolve_device(self) -> str:

        if self.device.lower() == "auto":

            try:
                import torch

                if torch.cuda.is_available():

                    logger.info(
                        "CUDA available: %s",
                        torch.cuda.get_device_name(0),
                    )

                    return "cuda:0"

            except Exception as exc:

                logger.warning(
                    "Could not check CUDA availability: %s",
                    exc,
                )

            return "cpu"

        return self.device


    # ========================================================
    # LOAD MODEL
    # ========================================================

    def _resolve_model_path(self) -> str:
        """Resolve portable env values relative to the backend or current directory."""
        configured_path = os.path.expanduser(self.model_path)
        if os.path.isabs(configured_path):
            return os.path.abspath(configured_path)

        candidates = [
            os.path.abspath(configured_path),
            os.path.abspath(os.path.join(BACKEND_DIR, configured_path)),
        ]
        normalized = configured_path.replace("\\", "/")
        if normalized.startswith("backend/"):
            candidates.append(os.path.join(BACKEND_DIR, normalized[len("backend/"):]))

        return next((path for path in candidates if os.path.isfile(path)), candidates[1])

    def _load_model(self):

        from ultralytics import YOLO

        target_path = self._resolve_model_path()

        # ----------------------------------------------------
        # NEVER silently fall back to normal YOLO
        # ----------------------------------------------------

        if not os.path.isfile(target_path):

            raise FileNotFoundError(
                "\nPPE model was not found.\n"
                f"Expected model path:\n{target_path}\n\n"
                "Make sure your fine-tuned best.pt exists inside:\n"
                "backend/ai/weights/best.pt"
            )

        device_str = self.selected_device

        logger.info("=" * 70)
        logger.info("PPE MODEL INITIALIZATION")
        logger.info("=" * 70)

        logger.info(
            "Model name     : %s",
            self.model_name,
        )

        logger.info(
            "Model version  : %s",
            self.model_version,
        )

        logger.info(
            "Model path     : %s",
            target_path,
        )

        logger.info(
            "Device         : %s",
            device_str,
        )

        logger.info(
            "Confidence     : %.2f",
            self.confidence_threshold,
        )

        logger.info(
            "IoU threshold  : %.2f",
            self.iou_threshold,
        )

        logger.info(
            "Image size     : %d",
            self.image_size,
        )

        try:

            self.model = YOLO(target_path)

            actual_names = {int(key): value for key, value in self.model.names.items()}
            if actual_names != EXPECTED_CLASS_NAMES:
                raise RuntimeError(
                    "Unexpected PPE model classes. Expected SafetyVision classes "
                    f"{EXPECTED_CLASS_NAMES}, received {actual_names}."
                )

            self.loaded_path = target_path
            self.model_sha256 = self._sha256(target_path)
            self.loaded_at = datetime.utcnow()

            logger.info(
                "Model loaded successfully."
            )

            logger.info(
                "Model classes: %s",
                self.model.names,
            )

            # Parameter count
            try:

                self.parameter_count = sum(
                    parameter.numel()
                    for parameter
                    in self.model.model.parameters()
                )

                logger.info(
                    "Model parameters: %s",
                    f"{self.parameter_count:,}",
                )

            except Exception:
                pass

            logger.info("=" * 70)

        except Exception as exc:

            logger.exception(
                "Failed to load PPE model from %s",
                target_path,
            )

            raise RuntimeError(
                f"Unable to load PPE model: {exc}"
            ) from exc

    @staticmethod
    def _sha256(file_path: str) -> str:
        """Return a stable model fingerprint without loading a second model."""
        digest = hashlib.sha256()
        with open(file_path, "rb") as model_file:
            for chunk in iter(lambda: model_file.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()


    # ========================================================
    # MODEL INFORMATION
    # ========================================================

    def get_model_info(self) -> Dict[str, Any]:

        return {
            "model_name": self.model_name,
            "model_version": self.model_version,
            "model_path": self.loaded_path,
            "classes": (
                self.model.names
                if self.model is not None
                else {}
            ),
            "confidence_threshold":
                self.confidence_threshold,
            "iou_threshold":
                self.iou_threshold,
            "image_size":
                self.image_size,
            "device":
                self.selected_device,
            "parameter_count": self.parameter_count,
            "model_sha256": self.model_sha256,
            "loaded_at": self.loaded_at.isoformat() if self.loaded_at else None,
        }


    # ========================================================
    # ANALYZE IMAGE
    # ========================================================

    def analyze_image(
        self,
        image_path: str,
        confidence_threshold: Optional[float] = None,
    ) -> Tuple[
        List[Dict[str, Any]],
        float,
        str,
        str,
    ]:

        """
        Run PPE detection on an image.

        Returns:
            detections
            processing_time_ms
            annotated_disk_path
            annotated_web_path
        """

        # ----------------------------------------------------
        # Validate model
        # ----------------------------------------------------

        if self.model is None:

            raise RuntimeError(
                "PPE model is not loaded."
            )

        # ----------------------------------------------------
        # Validate input image
        # ----------------------------------------------------

        image_path = os.path.abspath(image_path)

        if not os.path.isfile(image_path):

            raise FileNotFoundError(
                f"Image file not found: {image_path}"
            )

        # ----------------------------------------------------
        # Confidence threshold
        # ----------------------------------------------------

        if confidence_threshold is None:

            conf = self.confidence_threshold

        else:

            conf = float(confidence_threshold)

        # Safety limit
        conf = max(0.01, min(conf, 0.99))

        device_str = self.selected_device

        # ----------------------------------------------------
        # Inference
        # ----------------------------------------------------

        start_time = time.perf_counter()

        try:

            results = self.model.predict(
                source=image_path,
                imgsz=self.image_size,
                conf=conf,
                iou=self.iou_threshold,
                device=device_str,
                verbose=False,
            )

        except Exception as exc:

            logger.exception(
                "YOLO inference failed for %s",
                image_path,
            )

            raise RuntimeError(
                f"PPE inference failed: {exc}"
            ) from exc

        processing_time_ms = round(
            (time.perf_counter() - start_time) * 1000,
            2,
        )

        detections: List[Dict[str, Any]] = []


        # ====================================================
        # OPEN IMAGE FOR ANNOTATION
        # ====================================================

        try:

            original_image = Image.open(
                image_path
            ).convert("RGB")

            annotated_image = original_image.copy()

            draw = ImageDraw.Draw(
                annotated_image
            )

        except Exception as exc:

            raise ValueError(
                f"Corrupt or unreadable image: {exc}"
            ) from exc


        # ====================================================
        # PROCESS DETECTIONS
        # ====================================================

        for result in results:

            boxes = result.boxes

            if boxes is None:
                continue

            names = result.names

            for box in boxes:

                cls_id = int(
                    box.cls[0].item()
                )

                cls_name = names.get(
                    cls_id,
                    str(cls_id),
                )

                confidence = float(
                    box.conf[0].item()
                )

                coords = (
                    box.xyxy[0]
                    .cpu()
                    .tolist()
                )

                x1, y1, x2, y2 = coords

                detection = {
                    "class_id": cls_id,
                    "class_name": cls_name,
                    "confidence": round(
                        confidence,
                        4,
                    ),
                    "x1": round(x1, 2),
                    "y1": round(y1, 2),
                    "x2": round(x2, 2),
                    "y2": round(y2, 2),
                }

                detections.append(
                    detection
                )


                # ============================================
                # DRAW BOX
                # ============================================

                color = COLOR_MAP.get(
                    cls_name.lower(),
                    COLOR_MAP["default"],
                )

                draw.rectangle(
                    [x1, y1, x2, y2],
                    outline=color,
                    width=3,
                )


                # ============================================
                # LABEL
                # ============================================

                label_text = (
                    f"{cls_name} "
                    f"{confidence * 100:.1f}%"
                )

                label_y = max(
                    0,
                    y1 - 22,
                )

                try:

                    text_bbox = draw.textbbox(
                        (x1, label_y),
                        label_text,
                    )

                    draw.rectangle(
                        [
                            text_bbox[0] - 3,
                            text_bbox[1] - 3,
                            text_bbox[2] + 3,
                            text_bbox[3] + 3,
                        ],
                        fill=color,
                    )

                except Exception:

                    pass

                draw.text(
                    (x1, label_y),
                    label_text,
                    fill=(255, 255, 255),
                )


        # ====================================================
        # SORT DETECTIONS BY CONFIDENCE
        # ====================================================

        detections.sort(
            key=lambda item: item["confidence"],
            reverse=True,
        )


        # ====================================================
        # SAVE ANNOTATED IMAGE
        # ====================================================

        annotated_filename = (
            f"{uuid.uuid4().hex}_annotated.jpg"
        )

        annotated_disk_path = os.path.join(
            UPLOAD_AI_DIR,
            annotated_filename,
        )

        try:

            annotated_image.save(
                annotated_disk_path,
                "JPEG",
                quality=90,
            )

        except Exception as exc:

            logger.exception(
                "Could not save annotated image."
            )

            raise RuntimeError(
                f"Failed to save annotated image: {exc}"
            ) from exc


        annotated_web_path = (
            f"/uploads/ai/{annotated_filename}"
        )


        # ====================================================
        # LOG RESULT
        # ====================================================

        logger.info(
            "PPE inference completed | "
            "image=%s | detections=%d | "
            "time=%.2fms | conf=%.2f",
            os.path.basename(image_path),
            len(detections),
            processing_time_ms,
            conf,
        )


        return (
            detections,
            processing_time_ms,
            annotated_disk_path,
            annotated_web_path,
        )
