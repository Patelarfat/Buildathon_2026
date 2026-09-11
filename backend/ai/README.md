# Construction PPE Computer Vision Model Documentation

This directory contains the training pipeline, metadata, and weights configuration for the **Construction Site Intelligence Platform PPE Vision Model** (Phase 4).

---

## 1. Dataset Information

- **Dataset Name:** Construction-PPE (Official Ultralytics Dataset)
- **Dataset Configuration:** `construction-ppe.yaml`
- **Total Images:** 1,416 images
  - **Train Set:** 1,132 images
  - **Validation Set:** 143 images
  - **Test Set:** 141 images

### 11 Supported Classes:
| Class ID | Class Name | Category | Description |
| :--- | :--- | :--- | :--- |
| `0` | `helmet` | PPE Compliance | Hard hat / safety helmet on head |
| `1` | `gloves` | PPE Compliance | Protective gloves on hands |
| `2` | `vest` | PPE Compliance | High-visibility safety vest |
| `3` | `boots` | PPE Compliance | Safety work boots on feet |
| `4` | `goggles` | PPE Compliance | Eye protection goggles |
| `5` | `none` | Neutral | No equipment / background |
| `6` | `Person` | Object | Worker / human presence |
| `7` | `no_helmet` | Safety Violation | Head detected without safety helmet |
| `8` | `no_goggle` | Safety Violation | Eyes detected without goggles |
| `9` | `no_gloves` | Safety Violation | Hands detected without gloves |
| `10` | `no_boots` | Safety Violation | Feet detected without boots |

> [!IMPORTANT]
> **No-Vest Limitation:** The official Construction-PPE dataset **does NOT contain a dedicated `no_vest` class**. The system strictly detects `vest` when present, but does **not** invent an artificial `no_vest` class.

---

## 2. Model Architecture & Pretraining

- **Base Checkpoint:** `yolo11n.pt` (Ultralytics Lightweight Nano Detection Model)
- **Framework:** PyTorch & Ultralytics
- **Fine-Tuning Initialization:** Initialized from official COCO-pretrained weights (never trained from random weights).

---

## 3. How to Train / Fine-Tune

To execute the automated training and validation pipeline on your local hardware:

```powershell
cd backend
.\venv\Scripts\activate
python ai/train_ppe.py
```

### Script Execution Flow:
1. **Hardware Probe:** Detects GPU / CUDA / VRAM or falls back to CPU automatically.
2. **Dataset Acquisition:** Ultralytics automatically downloads and unpacks `Construction-PPE` on first invocation.
3. **Fine-Tuning:** Trains the model for 5 epochs with image size 640.
4. **Model Export:** Copies best weights to `backend/ai/weights/best.pt`.
5. **Real Metric Evaluation:** Evaluates model on validation split and saves real Precision, Recall, mAP50, and mAP50-95 to `backend/ai/model_metadata.json`.

---

## 4. Hardware Support & Auto-Fallback

- **CUDA Acceleration:** If an NVIDIA GPU is present (e.g. RTX 3050 Laptop GPU), CUDA is utilized automatically.
- **CPU Fallback:** If CUDA is unavailable, training and inference execute seamlessly on CPU.
- **Inference Runtime:** The FastAPI backend keeps the model loaded in memory across requests (`backend/services/yolo_service.py`), avoiding costly reloads.

---

## 5. Configuration & Environment Variables

Configure the inference service via `backend/.env` or system environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PPE_MODEL_PATH` | `backend/ai/weights/best.pt` | Path to fine-tuned YOLO weights file |
| `PPE_CONFIDENCE` | `0.25` | Minimum confidence threshold for detections (0.0 – 1.0) |
| `PPE_DEVICE` | `auto` | Execution device: `auto`, `cuda:0`, or `cpu` |

---

## 6. Safety Rule Engine & Severity Mapping

Visual detections from YOLO are analyzed deterministically by `backend/services/ppe_analyzer.py`:

| Detection | Generated Finding | Severity | Initial Status |
| :--- | :--- | :--- | :--- |
| `no_helmet` | `PERSON_WITHOUT_HELMET` | **HIGH** | `OPEN` |
| `no_gloves` | `PERSON_WITHOUT_GLOVES` | **MEDIUM** | `OPEN` |
| `no_boots` | `PERSON_WITHOUT_BOOTS` | **MEDIUM** | `OPEN` |
| `no_goggle` | `PERSON_WITHOUT_GOGGLES` | **MEDIUM** | `OPEN` |
| `helmet` | `HELMET_DETECTED` | `INFO` | `OPEN` |
| `vest` | `VEST_DETECTED` | `INFO` | `OPEN` |
| `gloves` | `GLOVES_DETECTED` | `INFO` | `OPEN` |
| `boots` | `BOOTS_DETECTED` | `INFO` | `OPEN` |
| `goggles` | `GOGGLES_DETECTED` | `INFO` | `OPEN` |

> [!NOTE]
> **Human-in-the-Loop:** AI findings are **never** treated as confirmed incidents automatically. Every finding is logged in `OPEN` status, allowing Safety Officers and Project Managers to review and mark as `REVIEWED`, `RESOLVED`, or `FALSE_POSITIVE` via the UI.

---

## 7. License & Compliance Advisory

- The **Construction-PPE dataset** is distributed under the **AGPL-3.0 License** according to official Ultralytics documentation.
- **Ultralytics YOLO** is open-source under AGPL-3.0 / Enterprise license.
- **Advisory:** For commercial deployments or proprietary distributions, review Ultralytics licensing terms and acquire enterprise licenses as appropriate.
