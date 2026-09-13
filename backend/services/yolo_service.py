import os
import time
import uuid
import logging
from typing import List, Dict, Any, Tuple, Optional
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

# Defaults
DEFAULT_MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ai", "weights", "best.pt")
UPLOAD_AI_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "ai")
os.makedirs(UPLOAD_AI_DIR, exist_ok=True)

# Color palettes for bounding box rendering
COLOR_MAP = {
    # Violations (Vibrant Red / Coral)
    "no_helmet": (239, 68, 68),
    "no_gloves": (249, 115, 22),
    "no_boots": (245, 158, 11),
    "no_goggle": (234, 88, 12),
    # Compliance (Vibrant Green / Cyan / Emerald)
    "helmet": (34, 197, 94),
    "vest": (16, 185, 129),
    "gloves": (6, 182, 212),
    "boots": (20, 184, 166),
    "goggles": (59, 130, 246),
    # Persons / Neutral (Blue / Slate)
    "person": (99, 102, 241),
    "default": (148, 163, 184),
}


class YOLOService:
    _instance: Optional["YOLOService"] = None

    def __init__(self):
        self.model = None
        self.model_path = os.getenv("PPE_MODEL_PATH", DEFAULT_MODEL_PATH)
        self.confidence_threshold = float(os.getenv("PPE_CONFIDENCE", "0.25"))
        self.device = os.getenv("PPE_DEVICE", "auto")
        self.model_name = "construction-ppe-yolo"
        self.model_version = "v1"
        self._load_model()

    @classmethod
    def get_instance(cls) -> "YOLOService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _resolve_device(self) -> str:
        if self.device == "auto":
            try:
                import torch
                if torch.cuda.is_available():
                    return "cuda:0"
            except Exception:
                pass
            return "cpu"
        return self.device

    def _load_model(self):
        from ultralytics import YOLO

        target_path = self.model_path
        if not os.path.exists(target_path):
            logger.warning(
                f"Trained PPE weights not found at '{target_path}'. Falling back to pretrained checkpoint."
            )
            # Check for standard nano model
            target_path = "yolo11n.pt"

        device_str = self._resolve_device()
        logger.info(f"Loading YOLO model from '{target_path}' on device '{device_str}'...")
        try:
            self.model = YOLO(target_path)
            self.loaded_path = target_path
            logger.info("YOLO Model loaded successfully into memory.")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            raise e

    def analyze_image(
        self,
        image_path: str,
        confidence_threshold: Optional[float] = None
    ) -> Tuple[List[Dict[str, Any]], float, str, str]:
        """
        Runs YOLO PPE detection on the specified image file.
        
        Returns:
            Tuple of (detections_list, processing_time_ms, annotated_disk_path, annotated_web_path)
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found at: {image_path}")

        conf = confidence_threshold if confidence_threshold is not None else self.confidence_threshold
        device_str = self._resolve_device()

        start_time = time.perf_counter()
        results = self.model.predict(
            source=image_path,
            conf=conf,
            device=device_str,
            verbose=False
        )
        processing_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

        detections: List[Dict[str, Any]] = []

        # Load image for drawing annotations
        try:
            orig_image = Image.open(image_path).convert("RGB")
            annotated_image = orig_image.copy()
            draw = ImageDraw.Draw(annotated_image)
        except Exception as e:
            raise ValueError(f"Corrupt or unreadable image file: {str(e)}")

        # Collect raw detections
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue

            names = result.names  # Class ID to name mapping
            for box in boxes:
                cls_id = int(box.cls[0].item())
                cls_name = names.get(cls_id, str(cls_id))
                confidence = float(box.conf[0].item())

                coords = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
                x1, y1, x2, y2 = coords[0], coords[1], coords[2], coords[3]

                detections.append({
                    "class_name": cls_name,
                    "confidence": round(confidence, 4),
                    "x1": round(x1, 2),
                    "y1": round(y1, 2),
                    "x2": round(x2, 2),
                    "y2": round(y2, 2)
                })

        # Identify person indices left-to-right for drawing consistent labels
        person_indices = {}
        person_dets = [d for d in detections if d["class_name"].lower() in ("person", "worker")]
        person_dets_sorted = sorted(person_dets, key=lambda d: d["x1"])
        for p_idx, p_det in enumerate(person_dets_sorted, start=1):
            # Key by bounding box coords tuple
            person_indices[(p_det["x1"], p_det["y1"], p_det["x2"], p_det["y2"])] = p_idx

        # Draw bounding boxes on annotated image
        for det in detections:
            cls_name = det["class_name"]
            confidence = det["confidence"]
            x1, y1, x2, y2 = det["x1"], det["y1"], det["x2"], det["y2"]

            color = COLOR_MAP.get(cls_name.lower(), COLOR_MAP["default"])
            draw.rectangle([x1, y1, x2, y2], outline=color, width=3)

            # Draw label badge
            key = (x1, y1, x2, y2)
            if key in person_indices:
                p_num = person_indices[key]
                label_text = f"Person {p_num} {int(confidence * 100)}%"
            else:
                label_text = f"{cls_name} {int(confidence * 100)}%"

            text_bbox = draw.textbbox((x1, max(0, y1 - 18)), label_text)
            draw.rectangle(
                [text_bbox[0] - 2, text_bbox[1] - 2, text_bbox[2] + 2, text_bbox[3] + 2],
                fill=color
            )
            draw.text((x1, max(0, y1 - 18)), label_text, fill=(255, 255, 255))

        # Save annotated image
        annotated_filename = f"{uuid.uuid4().hex}_annotated.jpg"
        annotated_disk_path = os.path.join(UPLOAD_AI_DIR, annotated_filename)
        annotated_image.save(annotated_disk_path, "JPEG", quality=90)
        annotated_web_path = f"/uploads/ai/{annotated_filename}"

        return detections, processing_time_ms, annotated_disk_path, annotated_web_path
